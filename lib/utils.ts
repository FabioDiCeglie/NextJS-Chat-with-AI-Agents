import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ActionCtx, MutationCtx, QueryCtx } from "@/convex/_generated/server";
import { ConvexHttpClient } from "convex/browser";
import {
    SSE_DONE_MESSAGE,
    StreamMessageType,
    SSE_DATA_PREFIX,
    StreamMessage,
  } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getConvexClient = () => {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
};

type ConvexCtx = MutationCtx | QueryCtx | ActionCtx;

export async function withErrorHandler<T>(
    operation: () => Promise<T>,
    errorMessage: string = "Operation failed"
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        throw new Error(`${errorMessage}: ${(error as Error).message}`);
    }
}

// Helper specifically for authenticated operations
export async function withAuth<T>(
    ctx: ConvexCtx,
    operation: (userId: string) => Promise<T>
): Promise<T> {
    return withErrorHandler(async () => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }
        return await operation(identity.subject);
    }, "Authentication failed");
}

/**
 * Creates a parser for Server-Sent Events (SSE) streams.
 * SSE allows real-time updates from server to client.
 */

export const createSSEParser = () => {
    let buffer = '';
    
    const parse = (chunk: string): StreamMessage[] => {
        const lines = (buffer + chunk).split("\n");
        buffer = lines.pop() || '';

        return lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith(SSE_DATA_PREFIX)) return null;
  
          const data = trimmed.substring(SSE_DATA_PREFIX.length);
          if (data === SSE_DONE_MESSAGE) return { type: StreamMessageType.Done };
  
          try {
            const parsed = JSON.parse(data) as StreamMessage;
            return Object.values(StreamMessageType).includes(parsed.type)
              ? parsed
              : null;
          } catch {
            return {
              type: StreamMessageType.Error,
              error: "Failed to parse SSE message",
            };
          }
        })
        .filter((msg): msg is StreamMessage => msg !== null);
    }

    return { parse };
};


const formatToolOutput = (output: unknown): string => {
  if (typeof output === "string") return output;
  return JSON.stringify(output, null, 2);
};

export const formatTerminalOutput = (
  tool: string,
  input: unknown,
  output: unknown
) => {
  const terminalHtml = `<div class="bg-[#1e1e1e] text-white font-mono p-2 rounded-md my-2 overflow-x-auto whitespace-normal max-w-[600px]">
    <div class="flex items-center gap-1.5 border-b border-gray-700 pb-1">
      <span class="text-red-500">●</span>
      <span class="text-yellow-500">●</span>
      <span class="text-green-500">●</span>
      <span class="text-gray-400 ml-1 text-sm">~/${tool}</span>
    </div>
    <div class="text-gray-400 mt-1">$ Input</div>
    <pre class="text-yellow-400 mt-0.5 whitespace-pre-wrap overflow-x-auto">${formatToolOutput(input)}</pre>
    <div class="text-gray-400 mt-2">$ Output</div>
    <pre class="text-green-400 mt-0.5 whitespace-pre-wrap overflow-x-auto">${formatToolOutput(output)}</pre>
  </div>`;

  return `---START---\n${terminalHtml}\n---END---`;
};