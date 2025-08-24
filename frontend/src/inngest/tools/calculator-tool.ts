import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function createCalculatorTool() {
  return tool(
    async ({ expression }: { expression: string }) => {
      const trimmed = String(expression ?? "");
      const sanitized = trimmed.replace(/\s+/g, "");
      if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
        throw new Error("Invalid expression");
      }
      let result: unknown;
      try {
        result = Function(`"use strict"; return (${sanitized})`)();
      } catch {
        throw new Error("Invalid expression");
      }
      if (typeof result !== "number" || !isFinite(result)) {
        throw new Error("Invalid result");
      }
      return String(result);
    },
    {
      name: "calculator",
      description:
        "Evaluate simple arithmetic expressions using +, -, *, /, and parentheses. Return only the numeric result.",
      schema: z.object({ expression: z.string() }),
    }
  );
}

