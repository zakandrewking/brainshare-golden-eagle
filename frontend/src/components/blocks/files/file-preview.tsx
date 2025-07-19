"use client";

import { useFile } from "@/components/blocks/files/logic/file";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import useIsSSR from "@/hooks/use-is-ssr";

export default function FilePreview({ id }: { id: string }) {
  const isSSR = useIsSSR();
  const { data, error, isLoading } = useFile(id);

  if (isSSR || isLoading) return <DelayedLoadingSpinner />;
  if (error || !data) return <SomethingWentWrong />;

  return <div>{`${data.name}`}</div>;
}
