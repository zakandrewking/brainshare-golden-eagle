"use client";

import React from "react";

import {
  type FileContent,
  useFile,
  useFileContent,
} from "@/components/blocks/files/logic/file";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";

function FileContentPreview({ content }: { content: FileContent }) {
  if (content.headers && content.parsedData) {
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

  // Text preview for other file types
  const previewText =
    content.text.length > 1000
      ? content.text.substring(0, 1000) + "..."
      : content.text;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">File Preview</h3>
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

  if (isSSR || isLoading || contentIsLoading) return <DelayedLoadingSpinner />;
  if (error || !fileData || contentError || !content)
    return <SomethingWentWrong />;

  return (
    <Stack alignItems="start">
      <div className="p-4 bg-muted rounded-md">
        <h3>{fileData.name}</h3>
        <p className="text-sm text-muted-foreground">
          {(fileData.size / 1024).toFixed(1)} KB
        </p>
      </div>
      <FileContentPreview content={content} />
    </Stack>
  );
}
