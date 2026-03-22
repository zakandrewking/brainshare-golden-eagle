/**
 * This is an example of a chat API endpoint that returns a ReadableStream.
 * We're not using it now, but it might be useful in the future.
 */

import { NextResponse } from "next/server";
import { convertToCoreMessages, streamText, type Message } from "ai";
import { detectHandoffIntentFromText } from "@/blocks/chat/logic/interrupt";
import { openai } from "@ai-sdk/openai";

import { defaultModel } from "@/llm-config";
import { getUser } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const { user } = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const bodyRecord = body as Record<string, unknown>;
  const messages = bodyRecord.messages as unknown[] | undefined;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  try {
    const uiMessages = (messages as Array<Record<string, unknown>>)
      .map((m) => {
        const role = String(m.role);
        const content = String(m.content ?? "");
        if (role === "tool") return { role: "assistant", content } satisfies Omit<Message, "id">;
        if (role === "system" || role === "user" || role === "assistant")
          return { role, content } as Omit<Message, "id">;
        if (role === "data") return { role: "data", content } as Omit<Message, "id">;
        return null;
      })
      .filter((m): m is Omit<Message, "id"> => m !== null);
    const result = await streamText({
      model: openai(defaultModel),
      messages: convertToCoreMessages(uiMessages),
      temperature: 0.2,
      // Phase 0: basic interrupt scaffold – detect intent in final text
      onFinish: async ({ text }) => {
        try {
          const finalText = typeof text === "string" ? text : String(text ?? "");
          if (detectHandoffIntentFromText(finalText)) {
            // Scaffold only – later phases will hand off to Inngest
            console.log("[chat] interrupt intent detected – ready for handoff");
          }
        } catch (e) {
          console.warn("[chat] interrupt detection failed", e);
        }
      },
    });

    return result.toDataStreamResponse({ headers: { "Cache-Control": "no-cache" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
