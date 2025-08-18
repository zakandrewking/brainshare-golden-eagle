import { createClient } from "@/utils/supabase/client";

export default async function createChat(title: string, userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("chat")
    .insert({
      title,
      user_id: userId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("Failed to create chat");
  }

  return data;
}
