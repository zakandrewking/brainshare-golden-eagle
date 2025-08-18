"use client";

import React from "react";

import {
  BookOpen,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteFile } from "@/blocks/files/logic/delete-file";
import { type FileData } from "@/blocks/files/logic/use-file-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  List,
  ListItem,
  ListItemActions,
  ListItemContent,
} from "@/components/ui/list";
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

function DeleteFileButton({
  fileId,
  fileName,
  onDelete,
}: {
  fileId: string;
  fileName: string;
  onDelete: () => void;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteFile(fileId);
      toast.success("File deleted");
      onDelete();
    } catch {
      // the logic function will log errors
      toast.error("An unexpected error occurred while deleting the file");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      disabled={isDeleting}
      onClick={handleDelete}
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      <span className="sr-only">Delete file</span>
    </Button>
  );
}

export default function FileList({
  files,
  onFileDeleted,
}: {
  files: FileData[];
  onFileDeleted: () => void;
}) {
  if (files.length === 0) {
    return <div>No files uploaded yet</div>;
  }

  return (
    <List className="w-full">
      {files.map((file: FileData) => {
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
              <DeleteFileButton
                fileId={file.id}
                fileName={file.name}
                onDelete={onFileDeleted}
              />
            </ListItemActions>
          </ListItem>
        );
      })}
    </List>
  );
}
