"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/trpc/client";

interface PdfOcrUploadProps {
  onTextExtracted: (result: {
    text: string;
    isSignedDocument: boolean;
    confidence: number;
    filename: string;
  }) => void;
  disabled?: boolean;
}

export default function PdfOcrUpload({ onTextExtracted, disabled = false }: PdfOcrUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const processUploadMutation = trpc.pdfOcr.processUpload.useMutation({
    onSuccess: (result) => {
      onTextExtracted({
        ...result,
        filename: uploadedFile?.name || "document.pdf",
      });
      setIsProcessing(false);
      setError(null);
    },
    onError: (error) => {
      setError(error.message);
      setIsProcessing(false);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploadedFile(file);
      setError(null);
      setIsProcessing(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const base64Content = base64Data.split(",")[1]; // Remove data:application/pdf;base64, prefix

        processUploadMutation.mutate({
          base64Data: base64Content,
          filename: file.name,
        });
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    },
    [processUploadMutation],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: disabled || isProcessing,
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          PDF Contract Upload
        </CardTitle>
        <CardDescription>
          Upload a PDF contract to automatically extract text using AI. Supports both signed and unsigned documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
            ${disabled || isProcessing ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-12 text-blue-500 animate-spin" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Processing PDF...</p>
                <p className="text-sm text-muted-foreground">
                  Extracting text using AI vision technology
                </p>
              </div>
            </div>
          ) : uploadedFile && !error ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="size-12 text-green-500" />
              <div className="space-y-2">
                <p className="text-lg font-medium">Processing Complete</p>
                <p className="text-sm text-muted-foreground">
                  Successfully extracted text from {uploadedFile.name}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Upload className="size-12 text-gray-400" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? "Drop PDF here..." : "Drag & drop PDF or click to select"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Maximum file size: 10MB • PDF files only
                </p>
              </div>
              <Button variant="outline" disabled={disabled || isProcessing}>
                Select PDF File
              </Button>
            </div>
          )}
        </div>

        {error && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {uploadedFile && !isProcessing && !error && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-500" />
                <div>
                  <p className="font-medium">{uploadedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  setError(null);
                }}
                disabled={isProcessing}
              >
                Remove
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          <h4 className="font-medium text-foreground">How it works:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Upload a PDF contract or document</li>
            <li>AI vision technology extracts all readable text</li>
            <li>Automatically detects if document is already signed</li>
            <li>Text can be used for digital signing or reference</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}