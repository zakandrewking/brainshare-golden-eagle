"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";

import createChat from "@/blocks/chat/logic/create-chat";
import useChats from "@/blocks/chat/logic/use-chats";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import useIsSSR from "@/hooks/use-is-ssr";
import { useUser } from "@/utils/supabase/client";

export default function ChatRedirect() {
  const isSSR = useIsSSR();
  const user = useUser();
  const { data, isLoading } = useChats();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (isSSR) return;
    if (!user) return;
    if (isLoading) return;
    if (navigatedRef.current) return;

    navigatedRef.current = true;

    const stored = typeof window !== "undefined" ? window.localStorage.getItem("lastChatId") : null;
    const chats = data || [];
    const hasStored = stored && chats.some((c) => c.id === stored);

    if (hasStored && stored) {
      window.location.replace(`/chat/${stored}`);
      return;
    }

    (async () => {
      try {
        const newChat = await createChat("New Chat", user.id);
        window.location.replace(`/chat/${newChat.id}`);
      } catch {
        toast.error("Failed to start a new chat");
        window.location.replace("/chat/history");
      }
    })();
  }, [isSSR, user, isLoading, data]);

  if (isSSR) return <></>;
  return <DelayedLoadingSpinner />;
}

