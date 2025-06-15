import { NextRequest, NextResponse } from "next/server";

import { getOrCreateDocAndToken } from "@y-sweet/sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { docId } = body;

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const connectionString = process.env.Y_SWEET_CONNECTION_STRING!;

    const token = await getOrCreateDocAndToken(connectionString, docId);

    return NextResponse.json({
      ...token,
      url: connectionString.startsWith("yss")
        ? token.url.replace("ws://", "wss://")
        : token.url,
    });
  } catch (error) {
    console.error("Error in auth endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
