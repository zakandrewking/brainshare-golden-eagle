/*
 Minimal streaming LangGraph agent that can be imported as a function
 or executed directly from CLI. Uses @langchain/openai for the model.
*/

import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";

// Basic env validation
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
});

function getEnv() {
  const parsed = EnvSchema.safeParse({ OPENAI_API_KEY: process.env.OPENAI_API_KEY });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Missing required environment variables");
  }
  return parsed.data;
}

// Build a super barebones 1-node graph that just calls the LLM
function buildGraph(modelName?: string) {
  const { OPENAI_API_KEY } = getEnv();

  const llm = new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    model: modelName ?? "gpt-4o-mini",
    temperature: 0.2,
  });

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("llm", async (state) => {
      // Expect most recent user message at the end
      const response = await llm.stream(state.messages);
      return { messages: [response] };
    })
    .addEdge(START, "llm")
    .addEdge("llm", END)
    .compile();

  return graph;
}

export type Agent0Options = {
  prompt: string;
  model?: string;
};

// Importable function: runs the agent and yields streamed tokens/messages
export async function* runAgent0(options: Agent0Options) {
  const graph = buildGraph(options.model);

  // LangGraph stream: we stream the final values for messages
  const stream = await graph.stream({
    messages: [
      {
        role: "user",
        content: options.prompt,
      },
    ],
  }, { streamMode: "values" });

  for await (const chunk of stream) {
    // Each chunk contains the state; we emit assistant deltas when available
    const messages = chunk?.messages ?? [];
    const last = messages[messages.length - 1];

    if (last && last.role === "assistant") {
      // Preferred: yield the entire assistant message as it grows
      yield last;
    }
  }
}

// When executed directly: run from CLI and print streaming text to stdout
if (import.meta.url === `file://${process.argv[1]}`) {
  // Usage: ts-node src/agents/agent0.ts "your prompt" [model]
  const [, , promptArg, modelArg] = process.argv;

  if (!promptArg) {
    console.error("Usage: node agent0.js \"your prompt\" [model]");
    process.exit(1);
  }

  (async () => {
    try {
      let lastPrinted = "";
      for await (const message of runAgent0({ prompt: promptArg, model: modelArg })) {
        const current = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
        // Print only the delta
        const delta = current.slice(lastPrinted.length);
        if (delta) process.stdout.write(delta);
        lastPrinted = current;
      }
      process.stdout.write("\n");
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
