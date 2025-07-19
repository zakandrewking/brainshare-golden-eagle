"use client";

import React from "react";

import { useChats } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";

export default function ChatList() {
  const isSSR = useIsSSR();
  const { data, error, isLoading } = useChats();

  if (isSSR) return <></>;
  if (isLoading) return <DelayedLoadingSpinner />;
  if (error || !data) return <SomethingWentWrong />;

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No chats yet. Start a conversation to get started!
      </div>
    );
  }

  return (
    <Stack direction="col" gap={2} alignItems="start" className="w-full">
      <h3 className="text-xl font-semibold">Recent Chats</h3>
      <div className="w-full space-y-2">
        {data.map((chat) => (
          <div
            key={chat.id}
            className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
          >
            <h4 className="font-medium truncate">{chat.title}</h4>
            <p className="text-sm text-muted-foreground">
              {new Date(chat.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </Stack>
  );
}
