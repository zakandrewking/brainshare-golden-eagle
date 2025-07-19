import useSWR from "swr";

import { parseCsv } from "@/utils/csv";
import { createClient } from "@/utils/supabase/client";

export interface FileContent {
  text: string;
  headers?: string[];
  parsedData?: string[][];
}

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useFile(id);
 * if (isSSR || isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 */
export function useFile(id: string) {
  const supabase = createClient();

  const { data, error, isLoading } = useSWR(
    `/files/${id}`,
    async () => {
      const { data, error } = await supabase
        .from("file")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        throw new Error(error?.message || "File not found");
      }

      return data;
    },
    {
      // use if data can change
      revalidateIfStale: true,
      // use if data changes regularly
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // use if data changes consistently
      refreshInterval: 0,
    }
  );

  return { data, error, isLoading };
}

export function useFileContent(bucketId?: string, objectPath?: string) {
  const supabase = createClient();

  const {
    data: content,
    error,
    isLoading,
  } = useSWR(
    bucketId && objectPath ? `/file-content/${bucketId}/${objectPath}` : null,
    async () => {
      const { data, error: downloadError } = await supabase.storage
        .from(bucketId!)
        .download(objectPath!);

      if (downloadError || !data) {
        throw new Error(downloadError?.message || "Failed to download file");
      }

      const text = await data.text();

      // Parse CSV if it's a CSV file
      const extension = objectPath!.split(".").pop()?.toLowerCase();
      if (extension === "csv") {
        try {
          const { headers, parsedData } = await parseCsv(text);
          return { text, headers, parsedData };
        } catch (parseError) {
          console.error("CSV parsing error:", parseError);
          return { text };
        }
      } else {
        return { text };
      }
    },
    {
      // use if data can change
      revalidateIfStale: true,
      // use if data changes regularly
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // use if data changes consistently
      refreshInterval: 0,
    }
  );

  return { content, error, isLoading };
}
