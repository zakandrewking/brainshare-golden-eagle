import useSWR from "swr";

import { createClient } from "@/utils/supabase/client";

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useFiles(id);
 * if (isSSR) return <></>;
 * if (isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 */
export default function useFiles() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR(
    "/files",
    async () => {
      const { data, error } = await supabase.from("file").select("*");
      if (error || !data) {
        console.error(error);
        throw new Error("Failed to load files");
      }
      return data;
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

  return { data, error, isLoading, mutate };
}
