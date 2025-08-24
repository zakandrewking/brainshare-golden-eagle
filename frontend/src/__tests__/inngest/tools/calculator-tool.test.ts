import { describe, it, expect } from "vitest";
import { createCalculatorTool } from "@/inngest/tools/calculator-tool";

describe("calculator tool", () => {
  it("evaluates simple addition", async () => {
    const tool = createCalculatorTool();
    const result = await tool.invoke({ expression: "2 + 3" });
    expect(result).toBe("5");
  });

  it("handles parentheses and precedence", async () => {
    const tool = createCalculatorTool();
    const result = await tool.invoke({ expression: "(2 + 3) * 4" });
    expect(result).toBe("20");
  });

  it("supports division", async () => {
    const tool = createCalculatorTool();
    const result = await tool.invoke({ expression: "10 / 2" });
    expect(result).toBe("5");
  });

  it("rejects invalid characters", async () => {
    const tool = createCalculatorTool();
    await expect(tool.invoke({ expression: "2 + alert(1)" })).rejects.toThrow(
      /Invalid expression/
    );
  });

  it("rejects invalid math", async () => {
    const tool = createCalculatorTool();
    await expect(tool.invoke({ expression: "(2+3" })).rejects.toThrow(
      /Invalid expression/
    );
  });
});

