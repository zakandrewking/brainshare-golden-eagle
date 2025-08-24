import { ChatOpenAI } from "@langchain/openai";

import { inngest } from "@/inngest/client";
import { defaultModel } from "@/llm-config";
import { createClientWithToken } from "@/utils/supabase/server";

export interface NewChatEventData {
  chatId: string;
  message: string;
  supabaseAccessToken: string;
  userId: string;
}

export const newChat = inngest.createFunction(
  { id: "new-chat" },
  { event: "chat/new" },
  async ({ event, step }) => {
    const { chatId, message, supabaseAccessToken } = event.data;
    const supabase = await createClientWithToken(supabaseAccessToken);

    const assistantRow = await step.run(
      "create-assistant-message",
      async () => {
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
          throw new Error(
            `Failed to create assistant message with error: ${error?.message}`
          );
        }

        return assistantRow;
      }
    );

    const full = await step.run("stream-chat", async () => {
      const THROTTLE_MS = 500;
      let lastUpdateTime = 0;
      let full = "";

      const normalized = message.trim().toLowerCase();
      const isListDocumentsRequest =
        /^\/list-?docs\b/.test(normalized) ||
        /\b(list|show)\b[\s\S]*\b(livetable|live table|table)\b[\s\S]*\b(docs|documents|tables)\b/.test(
          normalized
        );

      if (isListDocumentsRequest) {
        const { data: documents, error } = await supabase
          .from("document")
          .select("id, title, type, ysweet_id, liveblocks_id")
          .eq("type", "table")
          .order("title", { ascending: true });

        if (error) {
          console.error(error);
          throw new Error(
            `Failed to list documents with error: ${error?.message}`
          );
        }

        if (!documents || documents.length === 0) {
          full = "You have no LiveTable documents.";
        } else {
          const lines = documents.map(
            (doc) => `- ${doc.title} (/document/${doc.id})`
          );
          full = [
            "Here are your LiveTable documents:",
            "",
            ...lines,
          ].join("\n");
        }

        return full;
      }

      const model = new ChatOpenAI({ model: defaultModel });

      let stream;
      try {
        stream = await model.stream(message);
      } catch (error) {
        console.error(error);
        throw new Error(`Failed to process chat request with error: ${error}`);
      }

      for await (const chunk of stream) {
        const delta = String(chunk.content);
        if (!delta) continue;
        full += delta;

        const now = Date.now();
        if (now - lastUpdateTime >= THROTTLE_MS) {
          const { error } = await supabase
            .from("message")
            .update({ content: full })
            .eq("id", assistantRow.id);

          if (error) {
            console.warn(
              `Failed to update message with ID ${assistantRow.id} with error: ${error?.message}`
            );
          }

          lastUpdateTime = now;
        }
      }

      return full;
    });

    await step.run("finalize-message", async () => {
      const { error } = await supabase
        .from("message")
        .update({ content: full, status: "complete" })
        .eq("id", assistantRow.id);
      if (error) {
        console.error(error);
        throw new Error(
          `Failed to finalize message with error: ${error?.message}`
        );
      }
    });
  }
);
