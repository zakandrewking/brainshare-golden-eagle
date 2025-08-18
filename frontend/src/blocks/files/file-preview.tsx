"use client";

import React from "react";

import useFile from "@/blocks/files/logic/use-file";
import useFileContent, {
  type FileContent,
} from "@/blocks/files/logic/use-file-content";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";
import { SUPPORTED_FILE_TYPES } from "@/utils/file-types";

function NotebookPreview({ content }: { content: FileContent }) {
  if (!content.notebookCells) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Jupyter Notebook Preview</h3>
        <span className="text-sm text-muted-foreground">
          {content.notebookCells.length} cells
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-auto">
        {content.notebookCells.slice(0, 10).map((cell, index) => (
          <div
            key={index}
            className={`border rounded-md ${
              cell.cellType === "markdown"
                ? "border-blue-200 bg-blue-50/50"
                : "border-green-200 bg-green-50/50"
            }`}
          >
            <div className="px-3 py-1 border-b bg-muted/50 text-xs font-medium uppercase tracking-wide">
              {cell.cellType} cell {index + 1}
            </div>
            <div className="p-3">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {cell.source.join("")}
              </pre>
            </div>
          </div>
        ))}
        {content.notebookCells.length > 10 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            ... and {content.notebookCells.length - 10} more cells
          </div>
        )}
      </div>
    </div>
  );
}

function FileContentPreview({ content }: { content: FileContent }) {
  // Jupyter Notebook preview
  if (content.fileType === SUPPORTED_FILE_TYPES.IPYNB && content.isNotebook) {
    return <NotebookPreview content={content} />;
  }

  // CSV preview with table
  if (
    content.fileType === SUPPORTED_FILE_TYPES.CSV &&
    content.headers &&
    content.parsedData
  ) {
    const totalRows = content.parsedData.length;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">CSV Preview</h3>
          <span className="text-sm text-muted-foreground">
            {content.headers.length} columns, {totalRows} rows
          </span>
        </div>

        <div className="border overflow-auto">
          <table className="text-sm">
            <thead>
              <tr>
                {content.headers.map((header, index) => (
                  <th key={index} className="p-2">
                    {header || ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.parsedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={
                    rowIndex % 2 === 0 ? "bg-background" : "bg-muted/50"
                  }
                >
                  {content.headers!.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="p-2 border-r border-b max-w-48 truncate"
                    >
                      {row[colIndex] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Text preview for TXT and other file types
  const previewText =
    content.text.length > 1000
      ? content.text.substring(0, 1000) + "..."
      : content.text;

  const fileTypeLabel =
    content.fileType === SUPPORTED_FILE_TYPES.TXT
      ? "Text File Preview"
      : "File Preview";

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">{fileTypeLabel}</h3>
      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96 whitespace-pre-wrap">
        {previewText}
      </pre>
      {content.text.length > 1000 && (
        <p className="text-sm text-muted-foreground">
          Showing first 1000 characters of {content.text.length} total
        </p>
      )}
    </div>
  );
}

export default function FilePreview({ id }: { id: string }) {
  const isSSR = useIsSSR();
  const { data: fileData, error, isLoading } = useFile(id);
  const {
    content,
    isLoading: contentIsLoading,
    error: contentError,
  } = useFileContent(fileData?.bucket_id, fileData?.object_path);

  if (isSSR) return <></>;
  if (isLoading || contentIsLoading) return <DelayedLoadingSpinner />;
  if (error || !fileData || contentError || !content)
    return <SomethingWentWrong />;

  const getFileTypeIcon = () => {
    switch (content.fileType) {
      case SUPPORTED_FILE_TYPES.CSV:
        return "📊";
      case SUPPORTED_FILE_TYPES.IPYNB:
        return "📓";
      case SUPPORTED_FILE_TYPES.TXT:
        return "📄";
      default:
        return "📄";
    }
  };

  return (
    <Stack alignItems="start">
      <div className="p-4 bg-muted rounded-md">
        <h3 className="flex items-center gap-2">
          <span>{getFileTypeIcon()}</span>
          <span>{fileData.name}</span>
        </h3>
        <p className="text-sm text-muted-foreground">
          {(fileData.size / 1024).toFixed(1)} KB
          {content.fileType && ` • ${content.fileType.toUpperCase()} file`}
        </p>
      </div>
      <FileContentPreview content={content} />
    </Stack>
  );
}
