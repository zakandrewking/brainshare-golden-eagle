import useSWR from "swr";
import { createClient } from "@/utils/supabase/client";

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useMessages(chatId);
 * if (isSSR) return <></>;
 * if (isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 *
 * Realtime updates were previously handled via Supabase's realtime channels.
 * If you need to re-enable that behavior, see
 * `/frontend/docs/chat-realtime.md` for implementation notes.
 */
export default function useMessages(chatId: string) {
  const supabase = createClient();

  const { data, error, isLoading, mutate } = useSWR(
    chatId ? `/chat/${chatId}/messages` : null,
    async () => {
      const { data, error } = await supabase
        .from("message")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error || !data) {
        console.error(error);
        throw new Error("Failed to load messages");
      }

      return data;
    },
    {
      // use if data can change
      revalidateIfStale: true,
      // use if data changes regularly
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // use if data changes consistently & not using realtime
      refreshInterval: process.env.NEXT_PUBLIC_HANDOFF_ENABLED === "true" ? 1000 : 0,
    }
  );

  return { data, error, isLoading, mutate };
}
