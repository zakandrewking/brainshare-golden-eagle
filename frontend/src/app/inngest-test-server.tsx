"use server";

import { inngest } from "@/inngest/client";

export async function inngestTest() {
  await inngest.send({
    name: "test/hello.world",
    data: {
      email: "testUser@example.com",
    },
  });
}
