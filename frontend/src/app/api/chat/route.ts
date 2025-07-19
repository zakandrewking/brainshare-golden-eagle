import { NextRequest, NextResponse } from "next/server";

import { ChatOpenAI } from "@langchain/openai";

import { defaultModel } from "@/llm-config";

export async function POST(request: NextRequest) {
  const { message } = await request.json();

  const model = new ChatOpenAI({
    model: defaultModel,
  });

  let stream: ReadableStream;

  try {
    stream = await model.stream(message);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }

  return new NextResponse(stream);
}
