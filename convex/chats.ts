import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { withAuth } from "@/lib/utils";

export const createChat = mutation({
    args: {
        title: v.string(),
    },
    handler: async (ctx, args) => {
        return await withAuth(ctx, async (userId: string) => {
            return await ctx.db.insert("chats", {
                title: args.title,
                userId: userId,
                createdAt: Date.now(),
            });
        });
    }
});

export const deleteChat = mutation({
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

            const messages = await ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
                .collect();

            for (const message of messages) {
                await ctx.db.delete(message._id);
            }
            
            return await ctx.db.delete(args.chatId);
        });
    }
});

export const listChats = query({
    args: {},
    handler: async (ctx) => {
        return await withAuth(ctx, async (userId: string) => {
            return await ctx.db.query("chats").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
        });
    }
});