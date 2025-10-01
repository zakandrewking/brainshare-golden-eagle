import { inngest } from "@/inngest/client";
import { createClientWithToken } from "@/utils/supabase/server";

export const toolHandoff = inngest.createFunction(
  { id: "chat-tool-handoff" },
  { event: "chat/tool_handoff" },
  async ({ event, step }) => {
    const { chatId, rootMessageId, supabaseAccessToken } = event.data;
    const supabase = await createClientWithToken(supabaseAccessToken);

    await step.run("ensure-streaming", async () => {
      const { error } = await supabase
        .from("message")
        .update({ status: "streaming" })
        .eq("id", rootMessageId)
        .eq("chat_id", chatId);
      if (error) {
        console.warn(
          `Failed to mark message ${rootMessageId} streaming: ${error.message}`
        );
      }
    });

    const opening = "Let me check the current server time…\n\n";
    await step.run("write-opening", async () => {
      const { error } = await supabase
        .from("message")
        .update({ content: opening })
        .eq("id", rootMessageId)
        .eq("chat_id", chatId);
      if (error) {
        console.warn(
          `Failed to write opening for message ${rootMessageId}: ${error.message}`
        );
      }
    });

    await step.sleep("250ms");

    const now = new Date();
    const timeString = now.toLocaleString();
    const finalContent = `${opening}The current server time is: ${timeString}`;

    await step.run("finalize", async () => {
      const { error } = await supabase
        .from("message")
        .update({ content: finalContent, status: "complete" })
        .eq("id", rootMessageId)
        .eq("chat_id", chatId);
      if (error) {
        console.error(
          `Failed to finalize message ${rootMessageId}: ${error.message}`
        );
        throw new Error(
          `Failed to finalize message ${rootMessageId}: ${error.message}`
        );
      }
    });
  }
);
