"use server";

import { inngest } from "@/inngest/client";

export async function inngestTest() {
  console.log("inngestTest");
  const result = await inngest.send({
    name: "test/hello.world",
    data: {
      email: "testUser@example.com",
    },
  });
  console.log("inngestTest result", result);
}
