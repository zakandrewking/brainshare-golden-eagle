import { EventSchemas, Inngest } from "inngest";

type MessageCreatedEvent = {
  data: {
    chatId: string;
    message: string;
    supabaseAccessToken: string;
    userId: string;
  };
};

type ToolHandoffEvent = {
  data: {
    chatId: string;
    rootMessageId: string;
    supabaseAccessToken: string;
    userId: string;
    handoffEventId: string;
  };
};

type Events = {
  "message.created": MessageCreatedEvent;
  "chat/tool_handoff": ToolHandoffEvent;
};

export const inngest = new Inngest({
  id: "brainshare",
  // Inngest realtime doesn't work for streaming yet as far as I can tell. Each
  // `publish()` call creates a new `step`, which would start a brand new stream
  // if we did it outside of another step. We'll stick with supabase realtime.
  // middleware: [ realtimeMiddleware() ],
  schemas: new EventSchemas().fromRecord<Events>(),
});
