import { createClient } from "@/utils/supabase/client";

export default async function deleteChat(chatId: string, userId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("chat")
    .delete()
    .eq("id", chatId)
    .eq("user_id", userId);

  if (error) {
    console.error(error);
    throw new Error("Failed to delete chat");
  }

  return { success: true };
}
