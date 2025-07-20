import { EventSchemas, Inngest } from "inngest";

import { realtimeMiddleware } from "@inngest/realtime";

type NewChatEvent = {
  data: {
    chatId: string;
    message: string;
    supabaseAccessToken: string;
    userId: string;
  };
};
type Events = {
  "chat/new": NewChatEvent;
};

export const inngest = new Inngest({
  id: "chat-app",
  middleware: [realtimeMiddleware()],
  schemas: new EventSchemas().fromRecord<Events>(),
});
