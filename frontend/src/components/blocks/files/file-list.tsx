"use client";

import React from "react";

import {
  BookOpen,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import { type FileData, useFiles } from "@/components/blocks/files/logic/file";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  List,
  ListItem,
  ListItemActions,
  ListItemContent,
} from "@/components/ui/list";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import useIsSSR from "@/hooks/use-is-ssr";
import { SUPPORTED_FILE_TYPES } from "@/utils/file-types";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(extension: string) {
  switch (extension.toLowerCase()) {
    case SUPPORTED_FILE_TYPES.CSV:
      return <FileSpreadsheet size={20} className="text-green-600" />;
    case SUPPORTED_FILE_TYPES.IPYNB:
      return <BookOpen size={20} className="text-orange-600" />;
    case SUPPORTED_FILE_TYPES.TXT:
      return <FileText size={20} className="text-blue-600" />;
    default:
      return <FileText size={20} className="text-gray-600" />;
  }
}

// Placeholder component for delete file button (to be implemented later)
function DeleteFileButton({ fileId }: { fileId: string }) {
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled
      onClick={() => {
        console.log("Delete file:", fileId);
        // TODO: Implement delete functionality
      }}
    >
      Delete
    </Button>
  );
}

export default function FileList() {
  const isSSR = useIsSSR();
  const { data, error, isLoading } = useFiles();

  if (isSSR || isLoading) return <DelayedLoadingSpinner />;
  if (error || !data) return <SomethingWentWrong />;

  if (data.length === 0) {
    return <div>No files uploaded yet</div>;
  }

  return (
    <List className="w-full">
      {data.map((file: FileData) => {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";

        return (
          <ListItem key={file.id}>
            <ListItemContent href={`/file/${file.id}`}>
              <div className="flex items-center gap-3 w-full">
                {getFileIcon(extension)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {extension.toUpperCase()}
                </Badge>
              </div>
            </ListItemContent>
            <ListItemActions>
              <DeleteFileButton fileId={file.id} />
            </ListItemActions>
          </ListItem>
        );
      })}
    </List>
  );
}
