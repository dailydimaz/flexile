import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(isSignedElsewhere ? { signedUrl } : { signature });
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Contract Signature</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {richTextContent && (
            <div>
              <Label>Contract Content</Label>
              <div className="p-4 border rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm">{richTextContent}</pre>
              </div>
            </div>
          )}
          
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
          
          <Button type="submit" className="w-full">
            Sign Contract
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}