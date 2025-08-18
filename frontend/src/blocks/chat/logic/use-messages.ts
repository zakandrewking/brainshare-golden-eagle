import { useState } from "react";

import useSWR from "swr";

import { RealtimeChannel } from "@supabase/supabase-js";

import { useAsyncEffect } from "@/hooks/use-async-effect";
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
 */
export default function useMessages(chatId: string) {
  const supabase = createClient();
  const [myChannel, setMyChannel] = useState<RealtimeChannel | null>(null);

  useAsyncEffect(
    async () => {
      await supabase.realtime.setAuth();
      const myChannel = supabase.channel(`chat:${chatId}`, {
        config: { private: true },
      });
      myChannel
        .on("broadcast", { event: "*" }, (payload) => {
          console.log(payload);
        })
        .subscribe((_status, err) => {
          if (err) console.error(err);
        });
      setMyChannel(myChannel);
    },
    async () => {
      myChannel?.unsubscribe();
      setMyChannel(null);
    },
    [supabase]
  );

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
      // use if data changes consistently & not using realtime
      refreshInterval: 0,
    }
  );

  return { data, error, isLoading, mutate };
}
