"use client";

import React from "react";

import FileList from "@/components/blocks/files/file-list";
import FileUploader from "@/components/blocks/files/file-uploader";
import { useFiles } from "@/components/blocks/files/logic/file";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";

export default function FilesManager({
  isOverLimit,
}: {
  isOverLimit: boolean;
}) {
  const isSSR = useIsSSR();
  const { data, error, isLoading, mutate } = useFiles();

  if (isSSR) return <></>;
  if (isLoading) return <DelayedLoadingSpinner />;
  if (error || !data) return <SomethingWentWrong />;

  return (
    <>
      <FileUploader
        isOverLimit={isOverLimit}
        onUploadSuccess={() => mutate()}
      />
      <Stack direction="col" gap={2} alignItems="start" className="w-full">
        <h3 className="text-xl font-semibold">Files</h3>
        <FileList files={data} onFileDeleted={() => mutate()} />
      </Stack>
    </>
  );
}
