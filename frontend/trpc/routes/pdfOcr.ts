import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { companyProcedure, createRouter } from "@/trpc";
import { extractTextFromPdf, validatePdfFile, type PdfOcrResult } from "@/services/pdfOcrService";
import env from "@/env";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const pdfOcrRouter = createRouter({
  extractText: companyProcedure
    .input(z.object({
      fileKey: z.string(), // S3 file key from file upload
      filename: z.string(),
    }))
    .mutation(async ({ ctx, input }): Promise<PdfOcrResult> => {
      try {
        // Initialize S3 client
        const s3Client = new S3Client({
          region: env.AWS_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        });
        
        const bucket = env.S3_PRIVATE_BUCKET;
        if (!bucket) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "S3 bucket not configured" });
        }

        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: input.fileKey,
        });

        const response = await s3Client.send(command);
        if (!response.Body) {
          throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
        }

        // Convert stream to buffer
        const streamToBuffer = async (stream: any): Promise<Buffer> => {
          const chunks: Uint8Array[] = [];
          const reader = stream.getReader();
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            return Buffer.concat(chunks);
          } finally {
            reader.releaseLock();
          }
        };
        
        const buffer = await streamToBuffer(response.Body!.transformToWebStream());

        // Validate PDF
        const validation = validatePdfFile(buffer, input.filename);
        if (!validation.isValid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: validation.error || "Invalid PDF file" 
          });
        }

        // Extract text using OCR
        const ocrResult = await extractTextFromPdf(buffer);
        
        return ocrResult;
        
      } catch (error) {
        console.error("PDF OCR processing failed:", error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to process PDF document" 
        });
      }
    }),

  // Alternative endpoint for direct file upload processing
  processUpload: companyProcedure
    .input(z.object({
      base64Data: z.string(),
      filename: z.string(),
    }))
    .mutation(async ({ ctx, input }): Promise<PdfOcrResult> => {
      try {
        // Decode base64 to buffer
        const buffer = Buffer.from(input.base64Data, 'base64');
        
        // Validate PDF
        const validation = validatePdfFile(buffer, input.filename);
        if (!validation.isValid) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: validation.error || "Invalid PDF file" 
          });
        }

        // Extract text using OCR
        const ocrResult = await extractTextFromPdf(buffer);
        
        return ocrResult;
        
      } catch (error) {
        console.error("PDF OCR processing failed:", error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: "Failed to process PDF document" 
        });
      }
    }),
});