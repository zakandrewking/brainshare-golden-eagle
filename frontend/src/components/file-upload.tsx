"use client";

import { useState } from "react";

import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stack } from "@/components/ui/stack";

interface ProcessFileResult {
  message: string;
  success: boolean;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface FileUploadProps {
  onFileProcessed?: (result: ProcessFileResult) => void;
  disabled?: boolean;
}

export default function FileUpload({
  onFileProcessed,
  disabled,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, _setIsProcessing] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - only CSV and TSV
    const fileExtension = file.name.toLowerCase().split(".").pop();
    const isValidType =
      fileExtension === "csv" ||
      fileExtension === "tsv" ||
      (fileExtension === "txt" &&
        (file.type === "text/tab-separated-values" ||
          file.type === "text/csv"));

    if (!isValidType) {
      toast.error("Please upload a CSV or TSV file only.");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 10MB.");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
  };

  return (
    <Stack direction="col" gap={4} className="w-full">
      <div>
        <div className="mt-2 space-y-3">
          <Input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileSelect}
            disabled={disabled || isProcessing}
            className="hidden"
            id="file-upload"
          />
          <Label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-32 p-4 border-2 border-dashed border-gray-500 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-4 text-gray-500" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span>
              </p>
              <p className="text-xs text-gray-500">
                CSV or TSV files only (MAX. 10MB)
              </p>
            </div>
          </Label>

          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileRemove}
                disabled={disabled || isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Stack>
  );
}
