"use server";

import { inngest } from "@/inngest/client";
import { createClient, getUser } from "@/utils/supabase/server";

export async function callChat(chatId: string, message: string) {
  const { user } = await getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No session found");
  }

  const { data, error: messageError } = await supabase
    .from("message")
    .insert({
      chat_id: chatId,
      role: "user",
      content: message,
      status: "complete",
    })
    .select()
    .single();

  if (messageError) {
    console.error(messageError);
    throw new Error("Failed to save message");
  }

  try {
    await inngest.send({
      name: "new-chat", // event name
      data: {
        chatId,
        userId: user.id,
        supabaseAccessToken: session.access_token,
        messageId: data.id,
        message,
      },
    });
  } catch (error) {
    console.error(error);
    throw new Error("Failed to call chat");
  }
}
