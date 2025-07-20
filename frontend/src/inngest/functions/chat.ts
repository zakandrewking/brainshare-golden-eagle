import { Inngest } from "inngest";

import { ChatOpenAI } from "@langchain/openai";

import { defaultModel } from "@/llm-config";
import { createClientWithToken } from "@/utils/supabase/server";

export const inngest = new Inngest({
  id: "chat-app",
});

export const newChat = inngest.createFunction(
  { id: "new-chat" },
  { event: "new-chat" },
  async ({ event, step }) => {
    const { chatId, userId, messageId, message, supabaseAccessToken } =
      event.data;

    const supabase = await createClientWithToken(supabaseAccessToken);

    let full = "";

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
    try {
      stream = await model.stream(message);
    } catch (error) {
      console.error(error);
      throw new Error("Failed to process chat request");
    }

    for await (const chunk of stream) {
      const delta = chunk;
      if (!delta) continue;
      full += delta;

      await supabase
        .from("message")
        .update({ content: full })
        .eq("id", assistantRow.id);

      // update inngest realtime channel
      //   await step.send({
      //     name: "update-message",
      //     data: { messageId, content: full },
      //   });
    }

    await supabase
      .from("message")
      .update({ content: full, status: "complete" })
      .eq("id", assistantRow.id);

    return { message: `Hello chat` };
  }
);
