import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

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
      const calculator = tool({
        name: "calculator",
        description:
          "Evaluate simple arithmetic expressions using +, -, *, /, and parentheses. Return only the numeric result.",
        schema: z.object({ expression: z.string() }),
        func: async ({ expression }) => {
          const trimmed = String(expression ?? "");
          const sanitized = trimmed.replace(/\s+/g, "");
          if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
            throw new Error("Invalid expression");
          }
          let result: unknown;
          try {
            result = Function(`"use strict"; return (${sanitized})`)();
          } catch (e) {
            throw new Error("Invalid expression");
          }
          if (typeof result !== "number" || !isFinite(result)) {
            throw new Error("Invalid result");
          }
          return String(result);
        },
      });

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
        for (const call of firstResponse.tool_calls) {
          try {
            const result = await calculator.invoke(call.args as unknown);
            messages.push(new ToolMessage({ content: String(result), tool_call_id: call.id }));
          } catch (e) {
            messages.push(new ToolMessage({ content: "Error", tool_call_id: call.id }));
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
