import { channel, topic } from "@inngest/realtime";
import { ChatOpenAI } from "@langchain/openai";

import { inngest } from "@/inngest/client";
import { defaultModel } from "@/llm-config";
import { createClientWithToken } from "@/utils/supabase/server";

export const chatChannel = channel(
  (userId: string) => `chat:${userId}`
).addTopic(topic("messageChunks").type<string>());

export interface NewChatEventData {
  chatId: string;
  message: string;
  supabaseAccessToken: string;
  userId: string;
}

export const newChat = inngest.createFunction(
  { id: "new-chat" },
  { event: "chat/new" },
  async ({ event, publish }) => {
    const { chatId, message, supabaseAccessToken } = event.data;

    const supabase = await createClientWithToken(supabaseAccessToken);

    const THROTTLE_MS = 500;
    let lastUpdateTime = 0;

    let full = "";

    console.log("Creating empty assistant message for chat", chatId);
    const { data: assistantRow, error } = await supabase
      .from("message")
      .insert({
        chat_id: chatId,
        role: "assistant",
        status: "streaming",
        content: "",
      })
      .select()
      .single();

    if (error || !assistantRow) {
      console.error(error);
      throw new Error("Failed to create assistant message");
    }

    const model = new ChatOpenAI({ model: defaultModel });

    let stream;
    // const channel = newChatChannel();
    try {
      stream = await model.stream(message);
    } catch (error) {
      console.error(error);
      throw new Error("Failed to process chat request");
    }

    for await (const chunk of stream) {
      const delta = String(chunk.content);
      if (!delta) continue;
      full += delta;

      const now = Date.now();
      if (now - lastUpdateTime >= THROTTLE_MS) {
        console.log(
          "Updating message with ID",
          assistantRow.id,
          "with content",
          full
        );

        await supabase
          .from("message")
          .update({ content: full })
          .eq("id", assistantRow.id);

        lastUpdateTime = now;
      }

      // TODO clean up messages that are still listed as streaming because
      // there was an error or this job died

      // TODO this didn't work; was recalling the job a bunch. what's the right
      // way?
      // use await step.run(
      // publish(channel["message-chunks"](delta));
    }

    console.log(
      "Finalizing message with ID",
      assistantRow.id,
      "with content",
      full
    );
    await supabase
      .from("message")
      .update({ content: full, status: "complete" })
      .eq("id", assistantRow.id);

    // waiting on the result of my bug report https://app.inngest.com/support in
    // the meantime, keep polling for updates from supabase. or check out
    // brainshare-on-rails ;) console.log("publishing for user", userId); await
    // publish(chatChannel(userId).messageChunks("test")); await
    // publish(chatChannel(userId).messageChunks("test2"));

    return { message: `Hello chat` };
  }
);
