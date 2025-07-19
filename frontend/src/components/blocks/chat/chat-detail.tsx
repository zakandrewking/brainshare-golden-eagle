"use client";

import React, { useState } from "react";

import { toast } from "sonner";

import { useChat, useMessages } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
import useIsSSR from "@/hooks/use-is-ssr";
import { defaultModel } from "@/llm-config";

interface ChatDetailProps {
  chatId: string;
}

export default function ChatDetail({ chatId }: ChatDetailProps) {
  const isSSR = useIsSSR();
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
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
  } = useMessages(chatId);

  const handleStreamChat = async () => {
    if (!inputMessage.trim()) return;

    setIsStreaming(true);
    setStreamingResponse("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: inputMessage }),
      });

      if (!response.ok) {
        console.error("Failed to get a response", response);
        toast.error("Failed to get response from AI");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error("No reader available", response);
        toast.error("Failed to get response from AI");
        return;
      }

      const decoder = new TextDecoder();
      let accumulatedResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;
        setStreamingResponse(accumulatedResponse);
      }
    } catch (error) {
      console.error("Streaming error:", error);
      toast.error("Failed to get response from AI");
    } finally {
      setIsStreaming(false);
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
            disabled={isStreaming || !inputMessage.trim()}
            className="self-end"
          >
            {isStreaming ? "Streaming..." : "Send"}
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
          <></>
        )}
      </div>
    </div>
  );
}
