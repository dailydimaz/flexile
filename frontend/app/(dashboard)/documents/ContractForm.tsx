import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PdfOcrUpload from "./PdfOcrUpload";

interface ContractFormProps {
  richTextContent?: string;
  signedDocumentUrl?: string;
  isSignedElsewhere?: boolean;
  onSubmit?: (data: { signature?: string; signedUrl?: string }) => void;
}

export default function ContractForm({ 
  richTextContent, 
  signedDocumentUrl, 
  isSignedElsewhere = false,
  onSubmit 
}: ContractFormProps) {
  const [signature, setSignature] = useState("");
  const [signedUrl, setSignedUrl] = useState(signedDocumentUrl || "");
  const [contractText, setContractText] = useState(richTextContent || "");
  const [isSignedDoc, setIsSignedDoc] = useState(isSignedElsewhere);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(isSignedDoc ? { signedUrl } : { signature });
  };

  const handlePdfTextExtracted = (result: {
    text: string;
    isSignedDocument: boolean;
    confidence: number;
    filename: string;
  }) => {
    setContractText(result.text);
    setIsSignedDoc(result.isSignedDocument);
    
    if (result.isSignedDocument) {
      // If it's a signed document, we might want to treat it as a signed URL
      // For now, we'll just update the text content
      setSignedUrl(`Extracted from: ${result.filename} (${result.confidence.toFixed(2)} confidence)`);
    }
  };

  if (isSignedElsewhere && signedDocumentUrl) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Signed Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">This contract has been signed elsewhere.</p>
          <Button asChild variant="outline">
            <a href={signedDocumentUrl} target="_blank" rel="noopener noreferrer">
              View Signed Document
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isSignedElsewhere) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Link to Signed Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="signedUrl">Document URL</Label>
              <Input
                id="signedUrl"
                value={signedUrl}
                onChange={(e) => setSignedUrl(e.target.value)}
                placeholder="https://example.com/signed-contract.pdf"
                required
              />
            </div>
            <Button type="submit">Save Document Link</Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Contract Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={contractText ? "sign" : "upload"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload PDF</TabsTrigger>
            <TabsTrigger value="sign" disabled={!contractText}>
              Sign Contract
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-4">
            <PdfOcrUpload 
              onTextExtracted={handlePdfTextExtracted}
              disabled={false}
            />
            
            {contractText && (
              <div className="mt-6">
                <Label>Extracted Contract Text</Label>
                <div className="p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm">{contractText}</pre>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {isSignedDoc ? 
                    "⚠️ This document appears to already be signed." : 
                    "✅ This document appears to be unsigned and ready for signature."
                  }
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="sign" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {contractText && (
                <div>
                  <Label>Contract Content</Label>
                  <div className="p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">{contractText}</pre>
                  </div>
                </div>
              )}
              
              {isSignedDoc ? (
                <div>
                  <Label htmlFor="signedUrl">Signed Document Reference</Label>
                  <Input
                    id="signedUrl"
                    value={signedUrl}
                    onChange={(e) => setSignedUrl(e.target.value)}
                    placeholder="Document reference or URL"
                    required
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="signature">Digital Signature</Label>
                  <Textarea
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Type your full legal name to sign this document"
                    required
                  />
                </div>
              )}
              
              <Button type="submit" className="w-full">
                {isSignedDoc ? "Save Signed Document" : "Sign Contract"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}