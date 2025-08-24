import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createCalculatorTool } from "@/inngest/tools/calculator-tool";

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

    const full = await step.run("process-chat", async () => {
      const calculator = createCalculatorTool();

      const THROTTLE_MS = 500;
      let lastUpdateTime = 0;
      let full = "";
      const baseModel = new ChatOpenAI({ model: defaultModel });
      const model = baseModel.bindTools([calculator]);

      const messages: (HumanMessage | AIMessage | ToolMessage)[] = [
        new HumanMessage(message),
      ];

      let firstResponse: AIMessage;
      try {
        firstResponse = await model.invoke(messages);
      } catch (error) {
        console.error(error);
        throw new Error(`Failed to process chat request with error: ${error}`);
      }

      if (Array.isArray(firstResponse.tool_calls) && firstResponse.tool_calls.length > 0) {
        messages.push(firstResponse);
        const toCalculatorArgs = (input: unknown): { expression: string } => {
          if (typeof input === "string") return { expression: input };
          if (input && typeof input === "object") {
            const maybe = (input as { expression?: unknown }).expression;
            if (typeof maybe === "string") return { expression: maybe };
          }
          return { expression: String(input ?? "") };
        };
        for (const call of firstResponse.tool_calls) {
          try {
            const result = await calculator.invoke(toCalculatorArgs(call.args));
            messages.push(new ToolMessage({ content: String(result), tool_call_id: String(call.id) }));
          } catch {
            messages.push(new ToolMessage({ content: "Error", tool_call_id: String(call.id) }));
          }
        }

        let stream;
        try {
          stream = await model.stream(messages);
        } catch (error) {
          console.error(error);
          throw new Error(`Failed to process chat request with error: ${error}`);
        }

        for await (const chunk of stream) {
          const delta = String(chunk.content ?? "");
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
      } else {
        return String(firstResponse.content ?? "");
      }
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
