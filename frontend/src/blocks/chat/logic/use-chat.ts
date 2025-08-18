import useSWR from "swr";

import { createClient } from "@/utils/supabase/client";

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useChat(id);
 * if (isSSR) return <></>;
 * if (isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 */
export default function useChat(id: string) {
  const supabase = createClient();

  const { data, error, isLoading } = useSWR(
    `/chat/${id}`,
    async () => {
      const { data, error } = await supabase
        .from("chat")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        throw new Error("Chat not found");
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

  return { data, error, isLoading };
}
