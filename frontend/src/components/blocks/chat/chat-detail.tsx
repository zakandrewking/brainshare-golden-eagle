"use client";

import React from "react";

import { useChat, useMessages } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import useIsSSR from "@/hooks/use-is-ssr";

interface ChatDetailProps {
  chatId: string;
}

export default function ChatDetail({ chatId }: ChatDetailProps) {
  const isSSR = useIsSSR();
  const {
    data: chat,
    error: chatError,
    isLoading: chatLoading,
  } = useChat(chatId);
  const {
    data: messages,
    error: messagesError,
    isLoading: messagesLoading,
  } = useMessages(chatId);

  if (isSSR) return <></>;
  if (chatLoading || messagesLoading) return <DelayedLoadingSpinner />;
  if (chatError || messagesError || !chat) return <SomethingWentWrong />;

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{chat.title}</h1>
        <p className="text-muted-foreground">
          Created {new Date(chat.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id} className="p-4 border rounded-md">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {message.role === "user" ? "U" : "A"}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start a conversation!
          </div>
        )}
      </div>
    </div>
  );
}
