// run with:
// npx env-cmd -f .env -- npx tsx src/agents/agent0.mts

import { z } from "zod";

import {
  AIMessage,
  isAIMessageChunk,
  isBaseMessageChunk,
  isToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

const searchTool = tool(
  async ({ query: _query }: { query: string }) => {
    // This is a placeholder for the actual implementation
    return "42.2N, 83.7W";
  },
  {
    name: "search",
    description:
      "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
    schema: z.object({
      query: z.string().describe("The query to use in your search."),
    }),
  }
);

const tools = [searchTool];
const toolNode = new ToolNode(tools);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
}).bindTools(tools);

function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
  const lastMessage = messages[messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addNode("tools", toolNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

const agent = workflow.compile();

const stream = await agent.stream(
  {
    messages: [
      {
        role: "user",
        content:
          "tell me a tiny story that includes the GPS coords of both ann arbor michigan and san diego california. be sure to check what the real coords are",
      },
    ],
  },
  { streamMode: "messages" }
);

let isStreaming: string | null = null;

const debug = false;

process.stdout.write("[Start]");
for await (const [message, _metadata] of stream) {
  if (debug) {
    console.log(message);
    continue;
  }

  const isChunk = isBaseMessageChunk(message);
  const isTool = isToolMessage(message);
  const hasToolChunks =
    isChunk &&
    isAIMessageChunk(message) &&
    (message.tool_call_chunks?.length ?? 0) > 0;
  const hasMessageChunks =
    isChunk && isAIMessageChunk(message) && message.content !== "";

  if (isTool) {
    if (isStreaming !== "toolMessages") {
      isStreaming = "toolMessages";
    }
    process.stdout.write(
      `\n[Tool message (name: ${message.name} | result: ${message.content})]`
    );
    continue;
  }

  if (hasToolChunks) {
    const toolIndex = message.tool_call_chunks?.[0]?.index;
    if (isStreaming !== `toolChunks:${toolIndex}`) {
      isStreaming = `toolChunks:${toolIndex}`;
      process.stdout.write(`\n[Tool call (index: ${toolIndex})]\n`);
    }
    process.stdout.write(String(message.tool_call_chunks?.[0]?.args));
    continue;
  }

  if (hasMessageChunks) {
    if (isStreaming !== "messageChunks") {
      isStreaming = "messageChunks";
      process.stdout.write(`\n[Message]\n`);
    }
    process.stdout.write(String(message.content));
    continue;
  }
}
process.stdout.write("\n");
console.log("[Done]");
