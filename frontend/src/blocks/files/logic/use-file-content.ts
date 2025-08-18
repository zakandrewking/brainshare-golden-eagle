import useSWR from "swr";

import { parseCsv } from "@/utils/csv";
import { SUPPORTED_FILE_TYPES } from "@/utils/file-types";
import { createClient } from "@/utils/supabase/client";

export interface FileContent {
  text: string;
  headers?: string[];
  parsedData?: string[][];
  fileType?: string;
  isNotebook?: boolean;
  notebookCells?: Array<{
    cellType: string;
    source: string[];
    outputs?: unknown[];
  }>;
}

export interface FileData {
  id: string;
  name: string;
  size: number;
  bucket_id: string;
  object_path: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}
export default function useFileContent(bucketId?: string, objectPath?: string) {
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
        console.error(downloadError);
        throw new Error("Failed to download file");
      }

      const text = await data.text();
      const extension = objectPath!.split(".").pop()?.toLowerCase();

      // Parse different file types
      if (extension === SUPPORTED_FILE_TYPES.CSV) {
        try {
          const { headers, parsedData } = await parseCsv(text);
          return {
            text,
            headers,
            parsedData,
            fileType: SUPPORTED_FILE_TYPES.CSV,
          };
        } catch (parseError) {
          console.error("CSV parsing error:", parseError);
          return { text, fileType: SUPPORTED_FILE_TYPES.CSV };
        }
      } else if (extension === SUPPORTED_FILE_TYPES.IPYNB) {
        try {
          const notebook = JSON.parse(text);
          const cells = notebook.cells || [];
          const notebookCells = cells.map((cell: unknown) => {
            const typedCell = cell as {
              cell_type: string;
              source: string | string[];
              outputs?: unknown[];
            };
            return {
              cellType: typedCell.cell_type,
              source: Array.isArray(typedCell.source)
                ? typedCell.source
                : [typedCell.source || ""],
              outputs: typedCell.outputs || [],
            };
          });
          return {
            text,
            fileType: SUPPORTED_FILE_TYPES.IPYNB,
            isNotebook: true,
            notebookCells,
          };
        } catch (parseError) {
          console.error("IPYNB parsing error:", parseError);
          return { text, fileType: SUPPORTED_FILE_TYPES.IPYNB };
        }
      } else {
        // Handle TXT and other supported file types as plain text
        return {
          text,
          fileType: extension || "unknown",
        };
      }
    },
    {
      // use if data can change
      revalidateIfStale: true,
      // use if data changes regularly
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // use if data changes consistently & not using realtime
      refreshInterval: 0,
    }
  );

  return { content, error, isLoading };
}
