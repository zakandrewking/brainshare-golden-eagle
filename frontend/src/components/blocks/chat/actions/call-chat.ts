"use server";

import { inngest } from "@/inngest/client";

export async function callChat(chatId: string) {
  // TODO auth?

  try {
    console.log("callChat", chatId);
    const result = await inngest.send({
      name: "new-chat", // event name
      data: { chatId },
    });
    console.log("callChat result", result);
  } catch (error) {
    console.error(error);
    throw new Error("Failed to call chat");
  }
}
