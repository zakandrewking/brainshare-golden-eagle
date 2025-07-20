"use client";

import { Button } from "@/components/ui/button";

import { inngestTest } from "./inngest-test-server";

export default function InngestTest() {
  return (
    <Button className="mt-8" onClick={inngestTest}>
      Test Inngest
    </Button>
  );
}
