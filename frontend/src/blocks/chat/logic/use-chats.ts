import useSWR from "swr";

import { createClient } from "@/utils/supabase/client";

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useChats();
 * if (isSSR) return <></>;
 * if (isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 */
export default function useChats() {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR(
    "/chats",
    async () => {
      const { data, error } = await supabase
        .from("chat")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.error(error);
        throw new Error("Failed to load chats");
      }
      return data;
    },
    {
      // use if data can change
      revalidateIfStale: true,
      // use if data changes regularly
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // use if data changes consistently & not using realtime
      refreshInterval: 0,
    }
  );

  return { data, error, isLoading, mutate };
}
