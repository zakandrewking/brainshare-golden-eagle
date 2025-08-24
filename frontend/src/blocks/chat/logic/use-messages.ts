import { useState } from "react";

import useSWR from "swr";

import { RealtimeChannel } from "@supabase/supabase-js";

import { useAsyncEffect } from "@/hooks/use-async-effect";
import { upsertReplace } from "@/utils/data";
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
      refreshInterval: 0,
    }
  );

  useAsyncEffect(
    async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.realtime.setAuth(session.access_token);
      const myChannel = supabase.channel(`chat:${chatId}`, {
        config: { private: true },
      });
      myChannel
        .on("broadcast", { event: "UPDATE" }, (eventPayload) => {
          const newRecord = eventPayload.payload.record;
          mutate(
            (data) => (data ? upsertReplace(data, newRecord) : [newRecord]),
            false
          );
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

  return { data, error, isLoading, mutate };
}
