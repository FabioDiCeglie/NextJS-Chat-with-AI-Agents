import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { withAuth, withErrorHandler } from "@/lib/utils";

// We don't need to check for auth here because we check that in the server action ( chat -> page.tsx )
export const getMessages = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        return await withErrorHandler(async () => {
            return await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", args.chatId)).order("asc").collect();
        });
    }
});

export const getLastMessage = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        return await withAuth(ctx, async (userId: string) => {
            
            const chat = await ctx.db.get(args.chatId);

            if (!chat) {
                throw new Error("Chat not found");
            }
            if (chat.userId !== userId) {
                throw new Error("Unauthorized");
            }
            return await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", args.chatId)).order("desc").first();
        });
    }
});

// We don't need to check for auth here because we check that in the server action ( route.ts )
export const createMessageUser = mutation({
    args: {
        chatId: v.id("chats"),
        content: v.string(),
        role: v.union(v.literal("user"), v.literal("assistant")),
    },
    handler: async (ctx, args) => {
        return await withErrorHandler(async () => {
            return await ctx.db.insert("messages", {
                chatId: args.chatId,
                content: args.content.replace(/\n/g, "\\n"),
                role: args.role ?? 'user',
                createdAt: Date.now(),
            });
        });
    }
});