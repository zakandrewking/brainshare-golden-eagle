import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Supabase server utils
vi.mock("@/utils/supabase/server", () => {
  const insertSingle = vi.fn().mockResolvedValue({ data: { id: "msg-1" }, error: null });
  const selectMock = vi.fn().mockReturnValue({ single: insertSingle });
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
  const getSessionMock = vi.fn().mockResolvedValue({ data: { session: { access_token: "token" } } });
  const supabase = { auth: { getSession: getSessionMock }, from: fromMock };
  return {
    getUser: vi.fn().mockResolvedValue({ user: { id: "user-1" }, supabase, session: { access_token: "token" } }),
    createClient: vi.fn().mockResolvedValue(supabase),
  };
});

// Mock Inngest client
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn().mockResolvedValue(undefined) } }));

// Mock AI SDK stream
vi.mock("ai", () => {
  function makeTextStream(chunks: string[]) {
    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<string> {
        for (const c of chunks) yield c as string;
      },
    } as AsyncIterable<string>;
  }
  return {
    streamText: vi.fn().mockImplementation(() => ({
      textStream: makeTextStream(["first-chunk"]),
      toDataStreamResponse: () => new Response("ok"),
    })),
    convertToCoreMessages: <T>(m: T) => m,
  };
});

vi.mock("@ai-sdk/openai", () => ({ openai: (m: string) => m }));

import { POST } from "@/app/api/chat/route";
import { inngest } from "@/inngest/client";

describe("/api/chat handoff decision", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("triggers handoff for time-related queries", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: "chat-1", messages: [{ role: "user", content: "what time is it in PST?" }] }),
    });
    const res = await POST(req);
    expect(res).toBeInstanceOf(Response);
    await new Promise((r) => setTimeout(r, 0));
    type MockFn = ReturnType<typeof vi.fn>;
    const mockedInngest = (inngest as unknown as { send: MockFn });
    expect(mockedInngest.send).toHaveBeenCalledTimes(1);
  });

  it("does not handoff for non time queries", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId: "chat-2", messages: [{ role: "user", content: "what's a good time of year to visit Italy?" }] }),
    });
    const res = await POST(req);
    expect(res).toBeInstanceOf(Response);
    await new Promise((r) => setTimeout(r, 0));
    type MockFn = ReturnType<typeof vi.fn>;
    const mockedInngest = (inngest as unknown as { send: MockFn });
    expect(mockedInngest.send).not.toHaveBeenCalled();
  });
});
