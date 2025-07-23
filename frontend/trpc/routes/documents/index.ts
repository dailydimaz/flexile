import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull, not, or, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import { byExternalId, db } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, documents, documentSignatures, users } from "@/db/schema";
import { companyProcedure, createRouter } from "@/trpc";
import { simpleUser } from "@/trpc/routes/users";
import { assertDefined } from "@/utils/assert";
import { templatesRouter } from "./templates";

const visibleDocuments = (companyId: bigint, userId: bigint | SQLWrapper | undefined) =>
  and(
    eq(documents.companyId, companyId),
    isNull(documents.deletedAt),
    userId ? eq(documentSignatures.userId, userId) : undefined,
  );
export const documentsRouter = createRouter({
  list: companyProcedure
    .input(z.object({ userId: z.string().nullable(), signable: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
        throw new TRPCError({ code: "FORBIDDEN" });

      const signable = assertDefined(
        and(
          or(
            isNotNull(documents.richTextContent), 
            isNotNull(documents.signedDocumentUrl),
            eq(documents.isSignedElsewhere, true)
          ), 
          isNull(documentSignatures.signedAt)
        ),
      );
      const where = and(
        visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
        input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
      );
      const rows = await db
        .selectDistinctOn([documents.id], {
          ...pick(documents, "id", "name", "createdAt", "type", "richTextContent", "signedDocumentUrl", "isSignedElsewhere"),
          attachment: pick(activeStorageBlobs, "key", "filename"),
        })
        .from(documents)
        .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
        .innerJoin(users, eq(documentSignatures.userId, users.id))
        .leftJoin(
          activeStorageAttachments,
          and(eq(activeStorageAttachments.recordType, "Document"), eq(documents.id, activeStorageAttachments.recordId)),
        )
        .leftJoin(activeStorageBlobs, eq(activeStorageAttachments.blobId, activeStorageBlobs.id))
        .where(where)
        .orderBy(desc(documents.id));

      const signatories = await db.query.documentSignatures.findMany({
        columns: { documentId: true, title: true, signedAt: true },
        where: and(
          inArray(
            documentSignatures.documentId,
            rows.map((document) => document.id),
          ),
        ),
        with: { user: { columns: simpleUser.columns } },
        orderBy: desc(documentSignatures.signedAt),
      });

      return rows.map((document) => ({
        ...document,
        signatories: signatories
          .filter((signature) => signature.documentId === document.id)
          .map((signature) => ({
            ...simpleUser(signature.user),
            title: signature.title,
            signedAt: signature.signedAt,
          })),
      }));
    }),
  getUrl: companyProcedure.input(z.object({ id: z.bigint() })).query(async ({ ctx, input }) => {
    const [document] = await db
      .select({ signedDocumentUrl: documents.signedDocumentUrl })
      .from(documents)
      .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(
        and(
          eq(documents.id, input.id),
          visibleDocuments(ctx.company.id, ctx.companyAdministrator || ctx.companyLawyer ? undefined : ctx.user.id),
        ),
      )
      .limit(1);
    if (!document?.signedDocumentUrl) throw new TRPCError({ code: "NOT_FOUND" });
    return document.signedDocumentUrl;
  }),
  // TODO set up a DocuSeal webhook instead
  sign: companyProcedure
    .input(z.object({ 
      id: z.bigint(), 
      role: z.string(), 
      signature: z.string().optional(),
      signedDocumentUrl: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
    if (input.role === "Company Representative" && !ctx.companyAdministrator && !ctx.companyLawyer)
      throw new TRPCError({ code: "FORBIDDEN" });
    const [document] = await db
      .select()
      .from(documents)
      .innerJoin(documentSignatures, eq(documents.id, documentSignatures.documentId))
      .where(
        and(
          eq(documents.id, input.id),
          visibleDocuments(ctx.company.id, input.role === "Company Representative" ? undefined : ctx.user.id),
          eq(documentSignatures.title, input.role),
          isNull(documentSignatures.signedAt),
        ),
      )
      .limit(1);
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });

    // Update signature record
    await db
      .update(documentSignatures)
      .set({ signedAt: new Date() })
      .where(
        and(
          eq(documentSignatures.documentId, input.id),
          isNull(documentSignatures.signedAt),
          eq(documentSignatures.title, input.role),
        ),
      );

    // Update document with signature data if provided
    if (input.signature || input.signedDocumentUrl) {
      await db
        .update(documents)
        .set({
          ...(input.signedDocumentUrl && { signedDocumentUrl: input.signedDocumentUrl }),
          ...(input.signature && { 
            richTextContent: `Signed by: ${input.signature}` 
          }),
        })
        .where(eq(documents.id, input.id));
    }

    // Check if all signatures for this document have been signed
    const allSignatures = await db.select().from(documentSignatures).where(eq(documentSignatures.documentId, input.id));
    const allSigned = allSignatures.every((signature) => signature.signedAt !== null);

    return { documentId: input.id, complete: allSigned };
  }),

  templates: templatesRouter,
});
