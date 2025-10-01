import { createClient } from "@/utils/supabase/client";

export async function saveUserMessage(chatId: string, content: string) {
  const supabase = createClient();
  const { error } = await supabase.from("message").insert({
    chat_id: chatId,
    role: "user",
    content,
    status: "complete",
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to save message");
  }
}

export async function saveAssistantMessage(chatId: string, content: string) {
  const supabase = createClient();
  const { error } = await supabase.from("message").insert({
    chat_id: chatId,
    role: "assistant",
    content,
    status: "complete",
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to save message");
  }
}

