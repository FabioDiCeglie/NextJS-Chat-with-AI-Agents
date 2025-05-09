import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { SYSTEM_MESSAGE } from "@/constants/systemMessage";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  AIMessage,
  BaseMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";

const trimmer = trimMessages({
  maxTokens: 10,
  strategy: "last",
  tokenCounter: (msgs) => msgs.length,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
});

const toolClient = new wxflows({
  endpoint: process.env.WXFLOWS_ENDPOINT || "",
  apikey: process.env.WXFLOWS_API_KEY,
});

const initialiseModel = () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.7,
    maxOutputTokens: 8192,
    streaming: true,
    // check the usage of the tokens and caching
    // callbacks: [
    //   {
    //     handleLLMEnd: async (output) => {
    //       console.log("🤖 End LLM call - Google Output:", output.llmOutput);
    //       const usage = output.llmOutput?.tokenUsage;
    //       if (usage) {
    //         console.log("📊 Token Usage:", usage);
    //       }
    //     },
    //   },
    // ],
  });

  return model;
};

// const addCachingHeaders = (messages: BaseMessage[]): BaseMessage[] => {
//     if (!messages.length) return messages;

//     // Create a copy of messages to avoid mutating the original
//     const cachedMessages = [...messages];

//     // Helper to add cache control
//     const addCache = (message: BaseMessage) => {
//       message.content = [
//         {
//           type: "text",
//           text: message.content as string,
//           cache_control: { type: "ephemeral" },
//         },
//       ];
//     };

//     // Cache the last message
//     addCache(cachedMessages.at(-1)!);

//     // Find and cache the second-to-last human message
//     let humanCount = 0;
//     for (let i = cachedMessages.length - 1; i >= 0; i--) {
//       if (cachedMessages[i] instanceof HumanMessage) {
//         humanCount++;
//       if (humanCount === 2) {
//         addCache(cachedMessages[i]);
//         break;
//       }
//       }
//     }

//     return cachedMessages;
//   }

const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // if the LLM makes a tool call, then we route to the tools node
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }

  // if the last message is a tool message, route back to the agent node
  if (lastMessage.content && lastMessage._getType() === "tool") {
    return "agent";
  }

  return END;
};

const createWorkflow = async () => {
  try {
    const model = initialiseModel();
    const tools = await toolClient.lcTools;
    const toolNode = new ToolNode(tools);
    const bindModel = model.bindTools(tools);

    const stateGraph = new StateGraph(MessagesAnnotation)
      .addNode("agent", async (state) => {
        const systemContent = SYSTEM_MESSAGE;

        const promptTemplate = ChatPromptTemplate.fromMessages([
          new SystemMessage(systemContent, {
            cache_control: { type: "ephemeral" },
          }),
          new MessagesPlaceholder("messages"),
        ]);

        const trimmedMessages = await trimmer.invoke(state.messages);
        const prompt = await promptTemplate.invoke({
          messages: trimmedMessages,
        });

        const response = await bindModel.invoke(prompt);
        return { messages: [response] };
      })
      .addEdge(START, "agent")
      .addNode("tools", toolNode)
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    return stateGraph;
  } catch (error) {
    console.error("🚨 Error in createWorkflow:", error);
    throw error;
  }
};

export const submitQuestion = async (
  messages: BaseMessage[],
  chatId: string
) => {
  // use this function for anthropic caching
  // const cachedMessages = addCachingHeaders(messages);

  const workflow = await createWorkflow();

  // create a checkpointer to save the state of the conversation
  const checkpointer = new MemorySaver();
  const app = workflow.compile({ checkpointer });

  const stream = await app.streamEvents(
    { messages: messages },
    {
      version: "v2",
      configurable: { thread_id: chatId },
      streamMode: "messages",
      runId: chatId,
    }
  );

  return stream;
};
