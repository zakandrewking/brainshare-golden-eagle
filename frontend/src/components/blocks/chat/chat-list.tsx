"use client";

import React from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { useChats, useCreateChat } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";

export default function ChatList() {
  const isSSR = useIsSSR();
  const { data, error, isLoading, mutate } = useChats();
  const { createChat } = useCreateChat();

  const handleCreateChat = async () => {
    try {
      await createChat();
      toast.success("New chat created!");
      mutate();
    } catch (error) {
      console.error("Failed to create chat:", error);
      toast.error("Failed to create new chat");
    }
  };

  if (isSSR) return <></>;
  if (isLoading) return <DelayedLoadingSpinner />;
  if (error || !data) return <SomethingWentWrong />;

  return (
    <Stack direction="col" gap={2} alignItems="start" className="w-full">
      <div className="flex items-center justify-between w-full">
        <h3 className="text-xl font-semibold">Recent Chats</h3>
        <Button onClick={handleCreateChat} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 w-full">
          No chats yet. Start a conversation to get started!
        </div>
      ) : (
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
      )}
    </Stack>
  );
}
