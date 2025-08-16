"use client";

import { useEffect, useState } from "react";

import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function BroadcastTest() {
  const supabase = createClient();

  const [messages, setMessages] = useState<{ id: string; content: string }[]>(
    []
  );

  useEffect(() => {
    const myChannel = supabase.channel("test-channel", {
      config: {
        private: false,
      },
    });
    myChannel
      .on("broadcast", { event: "shout" }, (payload) =>
        setMessages((prev) => [
          ...prev,
          {
            id: payload.payload.id,
            content: payload.payload.message,
          },
        ])
      )
      .subscribe();

    return () => {
      myChannel.unsubscribe();
    };
  }, [supabase]);

  return (
    <div>
      <Button
        onClick={async () => {
          const myChannel = supabase.channel("test-channel", {
            config: {
              private: false,
            },
          });
          const res = await myChannel.send({
            type: "broadcast",
            event: "shout",
            payload: {
              id: uuidv4(),
              message: "Hello, world!",
            },
          });
          console.log(res);
        }}
      >
        Send Message
      </Button>
      <div>
        <div>Messages</div>
        {messages.map((message) => (
          <div key={message.id}>{message.content}</div>
        ))}
      </div>
    </div>
  );
}
