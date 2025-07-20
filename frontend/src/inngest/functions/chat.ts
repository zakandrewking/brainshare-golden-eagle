import { inngest } from "../client";

export const newChat = inngest.createFunction(
  { id: "new-chat" },
  { event: "new-chat" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { message: `Hello chat` };
  }
);
