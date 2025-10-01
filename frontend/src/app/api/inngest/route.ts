import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { newChat } from "@/inngest/functions/chat";
import { toolHandoff } from "@/inngest/functions/tool-handoff";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [newChat, toolHandoff],
});
