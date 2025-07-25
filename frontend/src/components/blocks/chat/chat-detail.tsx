"use client";

import React, { useState } from "react";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { useChat, useMessages } from "@/components/blocks/chat/logic/chat";
import SomethingWentWrong from "@/components/something-went-wrong";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
import useIsSSR from "@/hooks/use-is-ssr";
import { defaultModel } from "@/llm-config";
import { useUser } from "@/utils/supabase/client";

import { callChat } from "./actions/call-chat";

interface ChatDetailProps {
  chatId: string;
}

const CodeBlock = ({
  children,
  className,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) => {
  const language = className?.replace("language-", "") || "text";
  const codeString = String(children).replace(/\n$/, "");

  return (
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      customStyle={{
        margin: 0,
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
      }}
    >
      {codeString}
    </SyntaxHighlighter>
  );
};

const CustomParagraph = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  // Check if the paragraph contains only a code block
  const hasOnlyCodeBlock =
    React.Children.count(children) === 1 &&
    React.Children.toArray(children).every(
      (child) =>
        React.isValidElement(child) &&
        (child.type === CodeBlock ||
          (typeof child.props === "object" &&
            child.props &&
            "className" in child.props &&
            typeof child.props.className === "string" &&
            child.props.className.includes("language-")))
    );

  // If paragraph contains only a code block, render without <p> wrapper
  if (hasOnlyCodeBlock) {
    return <>{children}</>;
  }

  return <p {...props}>{children}</p>;
};

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
  } = useMessages(chatId);

  // const { data, error, freshData, state, latestData } = useInngestSubscription({
  //   refreshToken: () => fetchSubscriptionToken(user?.id ?? ""),
  //   bufferInterval: 500,
  //   enabled: true,
  // });

  // console.log("data", data);
  // console.log("error", error);
  // console.log("freshData", freshData);
  // console.log("state", state);
  // console.log("latestData", latestData);

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{chat.title}</h1>
            <p className="text-muted-foreground">
              Created {new Date(chat.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/chat">Chat History</Link>
          </Button>
        </div>
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
            <div className="w-full min-h-[200px] p-3 border rounded-md bg-background font-mono text-sm prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: CustomParagraph,
                }}
              >
                {streamingResponse}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {messages && messages.length > 0 ? (
          messages
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
                    <div className="whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: CodeBlock,
                          p: CustomParagraph,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
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
