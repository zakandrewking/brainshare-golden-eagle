/**
 * This is an example of a chat API endpoint that returns a ReadableStream.
 * We're not using it now, but it might be useful in the future.
 */

import { NextRequest, NextResponse } from "next/server";

import { ChatOpenAI } from "@langchain/openai";

import { defaultModel } from "@/llm-config";
import { getUser } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const { user } = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();

  const model = new ChatOpenAI({ model: defaultModel });

  let aiStream;
  try {
    aiStream = await model.stream(message);
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of aiStream) {
          const text = String(chunk.content);
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
