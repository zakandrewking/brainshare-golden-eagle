import { createClient } from "@/utils/supabase/client";

export default async function updateChatTitle(
  chatId: string,
  title: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("chat")
    .update({ title })
    .eq("id", chatId);

  if (error) {
    console.error(error);
    throw new Error("Failed to update chat title");
  }
}

