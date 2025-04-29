"use client";

import { Id, Doc } from "@/convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import { createSSEParser, getConvexClient, formatTerminalOutput } from "@/lib/utils";
import { ChatRequestBody, StreamMessageType } from "@/lib/types";
import { api } from "@/convex/_generated/api";

interface ChatInterfaceProps {
  chatId: Id<"chats">;
  initialMessages: Doc<"messages">[];
}

export default function ChatInterface({
  chatId,
  initialMessages,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Doc<"messages">[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState("");
  const [currentTool, setCurrentTool] = useState<{
    name: string;
    input: unknown;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const processStream = async (reader: ReadableStreamReader<Uint8Array>, onChunk: (chunk: string) => void) => {
    try{
      while(true){
        // @ts-ignore
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(new TextDecoder().decode(value));
      }
    }finally{
      reader.releaseLock()
    }
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamedResponse]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedInput = input.trim();

    if (!trimmedInput || isLoading) {
      return;
    }

    setInput("");
    setStreamedResponse("");
    setCurrentTool(null);
    setIsLoading(true);

    // Add user's message immediately for better UX
    const optimisticUserMessage: Doc<"messages"> = {
      _id: `temp_${Date.now()}`,
      chatId,
      content: trimmedInput,
      role: "user",
      createdAt: Date.now(),
    } as Doc<"messages">;

    setMessages((prev) => [...prev, optimisticUserMessage]);

    let fullResponse = "";

    try {
      const requestBody: ChatRequestBody = {
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        newMessage: trimmedInput,
        chatId,
      };

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
      if (!response.body) {
        throw new Error("No response body");
      }

     // -- Handling the stream --
     const parser = createSSEParser();
     const reader = response.body.getReader();

     // Process the stream
     await processStream(reader, async (chunk) => {
      const messages = parser.parse(chunk);
      for (const message of messages){
          switch(message.type){
            case StreamMessageType.Token:
            if("token" in message){
              fullResponse += message.token;
              setStreamedResponse(fullResponse);
            }
            break;
            case StreamMessageType.ToolStart:
              if("tool" in message){
                setCurrentTool({
                  name: message.tool,
                  input: message.input,
                });
                // @ts-ignore
                fullResponse += formatTerminalOutput(message.tool, message.input, "Processing...");
                setStreamedResponse(fullResponse);
              }
            break;
            case StreamMessageType.ToolEnd:
              if("tool" in message && currentTool){
                // Replace the "Processing..." with the actual tool output
                const lastTerminalIndex = fullResponse.lastIndexOf('<div class="bg-[#1e1e1e]">');
                if(lastTerminalIndex !== -1){
                  // @ts-ignore
                  fullResponse = fullResponse.substring(0, lastTerminalIndex) + formatTerminalOutput(message.tool, currentTool.input, message.output);
                }
                setStreamedResponse(fullResponse);
                setCurrentTool(null);
              }
            break;
            case StreamMessageType.Error:
              if("error" in message){
                throw new Error(message.error);
              }
            break;
            case StreamMessageType.Done:
              const assistantMessage: Doc<"messages"> = {
                _id: `temp_assistant_${Date.now()}`,
                chatId,
                content: fullResponse,
                role: "assistant",
                createdAt: Date.now(),
              } as Doc<"messages">;

              const convex = getConvexClient();
              await convex.mutation(api.messages.createMessageUser, {
                chatId,
                content: fullResponse,
                role: "assistant",
              })

              setMessages((prev) => [...prev, assistantMessage]);
              setStreamedResponse("");
            break;
          }
      }
     })
    } catch (error) {
      // Handle any errors during streaming
      console.error("Error sending message:", error);
      // Remove the optimistic user message if there was an error
      setMessages((prev) =>
        prev.filter((msg) => msg._id !== optimisticUserMessage._id)
      );
      setStreamedResponse(
        formatTerminalOutput(
          "error",
          "Failed to process message",
          error instanceof Error ? error.message : "Unknown error"
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-[calc(100vh-theme(spacing.14))]">
      {/* Messages container */}
      <section className="flex-1 overflow-y-auto bg-gray-50 p-2 md:p-0">
        <div>
          {messages.map((message) => (
            <div key={message._id}>{message.content}</div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </section>

      <footer className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message AI Agent..."
              className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12 bg-gray-50 placeholder:text-gray-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`absolute right-1.5 rounded-xl h-9 w-9 p-0 flex items-center justify-center transition-all ${
                input.trim()
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <ArrowRight />
            </Button>
          </div>
        </form>
      </footer>
    </main>
  );
}
