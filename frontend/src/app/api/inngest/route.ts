import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { newChat } from "@/inngest/functions/chat";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [newChat],
});
