"use server";

import { getSubscriptionToken } from "@inngest/realtime";

import { inngest } from "@/inngest/client";
import { chatChannel } from "@/inngest/functions/chat";

export default async function fetchSubscriptionToken(userId: string) {
  return getSubscriptionToken(inngest, {
    channel: chatChannel(userId),
    topics: ["messageChunks"],
  });
}
