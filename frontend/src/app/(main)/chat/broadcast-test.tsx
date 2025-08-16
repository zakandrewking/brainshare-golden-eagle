"use client";

import { useState } from "react";

import { v4 as uuidv4 } from "uuid";

import { RealtimeChannel } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { useAsyncEffect } from "@/hooks/use-async-effect";
import { createClient } from "@/utils/supabase/client";

export default function BroadcastTest() {
  const supabase = createClient();

  const [messages, setMessages] = useState<{ id: string; content: string }[]>(
    []
  );
  const [myChannel, setMyChannel] = useState<RealtimeChannel | null>(null);

  useAsyncEffect(
    async () => {
      await supabase.realtime.setAuth();
      const myChannel = supabase.channel("test-channel", {
        config: {
          private: true,
          broadcast: {
            self: true,
          },
        },
      });
      myChannel
        .on("broadcast", { event: "*" }, (payload) => {
          console.log(payload);
          setMessages((prev) => [
            ...prev,
            {
              id: payload.payload.id,
              content: payload.payload.message,
            },
          ]);
        })
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.log("Connected!");
          } else {
            console.error(err);
          }
        });
      setMyChannel(myChannel);
    },
    async () => {
      myChannel?.unsubscribe();
      setMyChannel(null);
    },
    [supabase]
  );

  return (
    <div>
      <Button
        disabled={!myChannel}
        onClick={async () => {
          const res = await myChannel?.send({
            type: "broadcast",
            event: "Test",
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
