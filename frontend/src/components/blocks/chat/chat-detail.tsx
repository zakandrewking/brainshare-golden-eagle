"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { toast } from "sonner";

import { useChat, useMessages } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
import useIsSSR from "@/hooks/use-is-ssr";
import { defaultModel } from "@/llm-config";
import { createClient, useUser } from "@/utils/supabase/client";

import { callChat } from "./actions/call-chat";

interface ChatDetailProps {
  chatId: string;
}

export default function ChatDetail({ chatId }: ChatDetailProps) {
  const isSSR = useIsSSR();
  const user = useUser();
  const [streamingResponse, setStreamingResponse] = useState("");
  const [inputMessage, setInputMessage] = useState("Hello, how are you?");

  const {
    data: chat,
    error: chatError,
    isLoading: chatLoading,
  } = useChat(chatId);
  const {
    data: messages,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useMessages(chatId);

  // subscribe to supabase realtime updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log("Change received!", payload);
          const newMessage = payload.new as {
            id: string;
            updated_at: string;
          };
          mutateMessages((currentMessages) => {
            if (!currentMessages) {
              return new Map([[newMessage.id, newMessage]]);
            }
            const existingMessage = currentMessages.get(newMessage.id);
            if (
              existingMessage &&
              new Date(existingMessage.updated_at) >=
                new Date(newMessage.updated_at)
            ) {
              return currentMessages;
            }
            const newMessages = new Map(currentMessages);
            newMessages.set(newMessage.id, payload.new);
            return newMessages;
          }, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, mutateMessages]);

  const handleStreamChat = async () => {
    if (!inputMessage.trim() || !user) return;

    setStreamingResponse("");

    try {
      await callChat(chatId, inputMessage);
      setInputMessage("");
    } catch {
      // the action will log errors
      toast.error("Failed to get response from AI");
    }
  };

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

      <div className="mb-6 p-4 border rounded-md bg-muted/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">AI Chat</h3>
          <Badge variant="secondary" className="text-xs">
            {defaultModel}
          </Badge>
        </div>

        <div className="flex gap-2 mb-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Enter your message..."
            className="flex-1"
            rows={2}
          />
          <Button
            onClick={handleStreamChat}
            disabled={!inputMessage.trim()}
            className="self-end"
          >
            Send
          </Button>
        </div>

        {streamingResponse && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">AI Response:</h3>
            <Textarea
              value={streamingResponse}
              readOnly
              className="w-full min-h-[200px] font-mono text-sm"
              placeholder="AI response will appear here..."
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {messages && messages.size > 0 ? (
          Array.from(messages.values())
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
            .map((message) => (
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
          <></>
        )}
      </div>
    </div>
  );
}
