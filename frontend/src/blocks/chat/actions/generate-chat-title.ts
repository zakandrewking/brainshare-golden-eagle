"use server";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import { defaultModel } from "@/llm-config";
import { getUser } from "@/utils/supabase/server";

export async function generateChatTitle(
  userMessage: string,
  assistantMessage: string
): Promise<string> {
  const { user } = await getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const prompt = [
      "You create concise, specific chat titles.",
      "Write a memorable title summarizing the user's request and assistant's reply.",
      "Constraints:",
      "- 3 to 6 words",
      "- Title Case",
      "- No punctuation at the end",
      "- No quotes or emojis",
      "- Avoid generic words like 'Chat' or 'Conversation'",
      "Context:",
      `User: ${userMessage}`,
      `Assistant: ${assistantMessage}`,
      "Title:"
    ].join("\n");

    const { text } = await generateText({
      model: openai(defaultModel),
      temperature: 0.2,
      prompt,
    });

    const candidate = String(text || "").trim();
    if (!candidate) {
      throw new Error("Failed to generate title");
    }
    return candidate.replace(/^"|"$/g, "");
  } catch (error) {
    console.error(error);
    throw new Error("Failed to generate chat title");
  }
}

