/**
 * This is an example of a chat API endpoint that returns a ReadableStream.
 * We're not using it now, but it might be useful in the future.
 */

import { NextResponse } from "next/server";
import { convertToCoreMessages, streamText, type Message } from "ai";
import { openai } from "@ai-sdk/openai";
import { inngest } from "@/inngest/client";
import { createClient } from "@/utils/supabase/server";

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
    });

    // Stage0: minimal handoff scaffold behind feature flag
    const handoffEnabled = process.env.NEXT_PUBLIC_HANDOFF_ENABLED === "true";
    if (handoffEnabled) {
      // Minimal: when first assistant chunk arrives, create placeholder assistant row and trigger Inngest
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // fire-and-forget stream tapping
      (async () => {
        let handoffSent = false;
        let assistantRowId: string | null = null;
        for await (const _chunk of result.textStream) {
          // forward is handled by AI SDK's toDataStreamResponse; we just inspect
          if (!handoffSent) {
            // For stage0, always handoff once on first chunk
            handoffSent = true;
            // Create placeholder message row
            const { data: row, error } = await supabase
              .from("message")
              .insert({ chat_id: String(bodyRecord.chatId || bodyRecord.id || ""), role: "assistant", status: "streaming", content: "" })
              .select()
              .single();
            if (error || !row) {
              console.warn("Failed to insert assistant placeholder", error);
              continue;
            }
            assistantRowId = row.id;

            if (session) {
              await inngest.send({
                name: "chat/tool_handoff",
                data: {
                  chatId: String(bodyRecord.chatId || bodyRecord.id || ""),
                  rootMessageId: assistantRowId,
                  supabaseAccessToken: session.access_token,
                  userId: user.id,
                  handoffEventId: row.id,
                },
                id: row.id,
              });
            }
          }
        }
      })().catch(() => {});
    }

    return result.toDataStreamResponse({ headers: { "Cache-Control": "no-cache" } });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
