import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { pick } from "lodash-es";
import { z } from "zod";
import { db } from "@/db";
import { DocumentTemplateType } from "@/db/enums";
import { documentTemplates } from "@/db/schema";
import { companyProcedure, createRouter, protectedProcedure } from "@/trpc";

export const templatesRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        type: z.nativeEnum(DocumentTemplateType).optional(),
        companyId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = and(
        input.companyId ? eq(documentTemplates.companyId, BigInt(input.companyId)) : undefined,
        input.type ? eq(documentTemplates.type, input.type) : undefined,
        or(
          eq(documentTemplates.companyId, ctx.company.id),
          isNull(documentTemplates.companyId),
        ),
      );

      return await db
        .select(pick(documentTemplates, "id", "name", "type", "externalId", "signable", "richTextContent"))
        .from(documentTemplates)
        .where(where)
        .orderBy(asc(documentTemplates.name));
    }),

  get: companyProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const template = await db.query.documentTemplates.findFirst({
      where: and(
        eq(documentTemplates.externalId, input.id),
        or(
          eq(documentTemplates.companyId, ctx.company.id),
          isNull(documentTemplates.companyId),
        ),
      ),
    });

    if (!template) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      template: pick(template, "id", "name", "type", "richTextContent", "signedDocumentUrl", "isSignedElsewhere"),
      // Return empty values since we don't need Docuseal integration
      token: "",
      requiredFields: [],
    };
  }),

  create: companyProcedure
    .input(createInsertSchema(documentTemplates).pick({ 
      name: true, 
      type: true, 
      richTextContent: true, 
      signedDocumentUrl: true, 
      isSignedElsewhere: true 
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const [row] = await db
        .insert(documentTemplates)
        .values({ 
          ...input, 
          companyId: ctx.company.id,
          signable: true, // Enable signing for new templates
        })
        .returning();

      return row?.externalId;
    }),

  update: companyProcedure
    .input(
      createUpdateSchema(documentTemplates)
        .pick({ 
          name: true, 
          richTextContent: true, 
          signedDocumentUrl: true, 
          isSignedElsewhere: true 
        })
        .extend({ id: z.string() }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.companyAdministrator && !ctx.companyLawyer) throw new TRPCError({ code: "FORBIDDEN" });

      const { id, ...updateData } = input;
      
      await db
        .update(documentTemplates)
        .set(updateData)
        .where(
          and(
            eq(documentTemplates.externalId, id),
            eq(documentTemplates.companyId, ctx.company.id),
          ),
        );

      return { success: true };
    }),
});