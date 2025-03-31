import { api } from "@/convex/_generated/api";
import { ChatRequestBody, SSE_DATA_PREFIX, StreamMessage, SSE_LINE_DELIMITER, StreamMessageType } from "@/lib/types";
import { getConvexClient } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";

const sendSSEMessage = (
    writer: WritableStreamDefaultWriter<Uint8Array>,
    data: StreamMessage
  ) => {
    const encoder = new TextEncoder();
    return writer.write(
      encoder.encode(
        `${SSE_DATA_PREFIX}${JSON.stringify(data)}${SSE_LINE_DELIMITER}`
      )
    );
  }

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const body: ChatRequestBody = await req.json();
    const { messages, newMessage, chatId } = body;

    const convex = getConvexClient();

    const stream = new TransformStream({}, { highWaterMark: 1024 });
    const writer = stream.writable.getWriter();

    const response = new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

    const startStream = async () => {
      try {

        await sendSSEMessage(writer, { type: StreamMessageType.Connected });

        await convex.mutation(api.messages.createMessageUser, {
            chatId,
            content: newMessage,
        });
        
        // Close the stream
        await writer.close();
      } catch (error) {
        console.error("Error in chat API:", error);
        await writer.abort();
        return new Response("Internal Server Error", { status: 500 });
      }
    };

    // Start streaming
    startStream().catch((error) => {
      console.error("Stream error:", error);
    });

  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
