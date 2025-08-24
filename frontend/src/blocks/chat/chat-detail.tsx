"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { nanoid } from "nanoid";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import SomethingWentWrong from "@/components/something-went-wrong";
import { Button } from "@/components/ui/button";
import { DelayedLoadingSpinner, LoadingSpinner } from "@/components/ui/loading";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import useIsSSR from "@/hooks/use-is-ssr";
import { useUser } from "@/utils/supabase/client";

import { callChat } from "./actions/call-chat";
import useChat from "./logic/use-chat";
import useMessages from "./logic/use-messages";

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

  if (hasOnlyCodeBlock) {
    return <>{children}</>;
  }

  return <p {...props}>{children}</p>;
};

function hasAssistantStreaming(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  for (const m of messages) {
    if (typeof m !== "object" || m === null) continue;
    const rec = m as Record<string, unknown>;
    const role = rec.role;
    const status = rec.status;
    if (
      typeof role === "string" &&
      typeof status === "string" &&
      role === "assistant" &&
      status === "streaming"
    ) {
      return true;
    }
  }
  return false;
}

export default function ChatDetail({ chatId }: ChatDetailProps) {
  const isSSR = useIsSSR();
  const user = useUser();
  const [streamingMessages, _setStreamingMessages] = useState<
    { id: string; content: string }[]
  >([]);
  const [inputMessage, setInputMessage] = useState("Hello, how are you?");
  const [forceThinking, setForceThinking] = useState(false);
  const isMac =
    typeof window !== "undefined" &&
    (/Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      /Macintosh/.test(navigator.userAgent));

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

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessages, forceThinking]);

  const serverStreaming = hasAssistantStreaming(messages);
  const isThinking = forceThinking || serverStreaming;

  useEffect(() => {
    if (serverStreaming) setForceThinking(false);
  }, [serverStreaming]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !user) return;

    const messageToSend = inputMessage;
    const optimisticMessage = {
      id: `optimistic-${nanoid()}`,
      chat_id: chatId,
      role: "user",
      content: messageToSend,
      created_at: new Date().toISOString(),
    };

    setForceThinking(true);
    await mutateMessages(
      (prev) => (prev ? [...prev, optimisticMessage] : [optimisticMessage]),
      false
    );

    setInputMessage("");

    try {
      await callChat(chatId, messageToSend);
      await mutateMessages();
    } catch {
      setForceThinking(false);
      await mutateMessages(
        (prev) =>
          prev ? prev.filter((m) => m.id !== optimisticMessage.id) : [],
        false
      );
      toast.error("Failed to get response from AI");
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isSSR) return <></>;
  if (chatLoading || messagesLoading) return <DelayedLoadingSpinner />;
  if (chatError || messagesError || !chat) return <SomethingWentWrong />;

  return (
    <div className="w-full flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
      <div className="mb-4">
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

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
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

            {streamingMessages.length > 0 && (
              <div className="p-4 border rounded-md">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    A
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">
                      Assistant
                    </p>
                    <div className="whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code: CodeBlock,
                          p: CustomParagraph,
                        }}
                      >
                        {streamingMessages
                          .map((message) => message.content)
                          .join("\n")}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="bg-background border-t">
        <div className="p-4">
          {isThinking && (
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <LoadingSpinner className="w-4 h-4" />
              <span className="text-sm">Thinking…</span>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your message..."
              className="flex-1 resize-none"
              rows={2}
            />
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || isThinking}
              className="self-end"
            >
              Send
              <span className="ml-2 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                {isMac ? "⌘↵" : "Ctrl↵"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
