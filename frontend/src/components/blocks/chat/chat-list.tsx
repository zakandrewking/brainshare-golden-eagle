"use client";

import React from "react";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { toast } from "sonner";

import { useChats } from "@/components/blocks/chat/logic/chat";
import createChat from "@/components/blocks/chat/logic/create-chat";
import deleteChat from "@/components/blocks/chat/logic/delete-chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Stack } from "@/components/ui/stack";
import useIsSSR from "@/hooks/use-is-ssr";
import { useUser } from "@/utils/supabase/client";
import { logInRedirect } from "@/utils/url";

export default function ChatList() {
  const user = useUser();
  const isSSR = useIsSSR();
  const { data, error, isLoading, mutate } = useChats();
  const router = useRouter();

  const handleCreateChat = async () => {
    if (!user) {
      redirect(logInRedirect("/chat"));
    }

    try {
      const chat = await createChat("New Chat", user.id);
      router.push(`/chat/${chat.id}`);
    } catch {
      // the logic function will log errors
      toast.error("Failed to create new chat");
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!user) return;

    try {
      await deleteChat(chatId, user.id);
      // Optimistically update the UI
      mutate();
      toast.success("Chat deleted");
    } catch {
      toast.error("Failed to delete chat");
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
        <Stack direction="col" gap={2} alignItems="start" className="w-full">
          {data.map((chat) => (
            <div
              key={chat.id}
              className="p-3 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors flex flex-row gap-2 items-center justify-between w-full"
            >
              <Link href={`/chat/${chat.id}`} className="flex-1">
                <div>
                  <h4 className="font-medium truncate">{chat.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(chat.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
