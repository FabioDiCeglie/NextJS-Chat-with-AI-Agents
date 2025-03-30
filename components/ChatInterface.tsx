'use client';

import { Id, Doc } from "@/convex/_generated/dataModel";
import { useState } from "react";
interface ChatInterfaceProps {
    chatId: Id<"chats">;
    initialMessages: Doc<"messages">[];
}

export default function ChatInterface({ chatId, initialMessages }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Doc<"messages">[]>(initialMessages);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    return (
        <div>
            <h1>Chat Interface</h1>
        </div>
    );
}