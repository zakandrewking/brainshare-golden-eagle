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
export function useChats() {
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
      // use if data changes consistently
      refreshInterval: 0,
    }
  );

  return { data, error, isLoading, mutate };
}

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
export function useChat(id: string) {
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
      // use if data changes consistently
      refreshInterval: 1_000,
    }
  );

  return { data, error, isLoading };
}

/**
 * Use like:
 *
 * const isSSR = useIsSSR();
 * const { data, error, isLoading } = useMessages(chatId);
 * if (isSSR) return <></>;
 * if (isLoading) return <DelayedLoadingSpinner />;
 * if (error || !data) return <SomethingWentWrong />;
 * return ...
 */
export function useMessages(chatId: string) {
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
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // use if data changes consistently
      refreshInterval: 1_000,
    }
  );

  return { data, error, isLoading, mutate };
}
