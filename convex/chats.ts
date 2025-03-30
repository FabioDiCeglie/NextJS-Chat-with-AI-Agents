import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { withAuth, withErrorHandler } from "@/lib/utils";

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
  },
});

export const getChat = query({
  args: {
    id: v.id("chats"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await withErrorHandler(async () => {
      const chat = await ctx.db.get(args.id);
      // Return null if chat doesn't exist or user is not authorized
      if (!chat || chat.userId !== args.userId) {
        console.log("❌ Chat not found or unauthorized", {
          chatExists: !!chat,
          chatUserId: chat?.userId,
          requestUserId: args.userId,
        });
        return null;
      }
      return await chat;
    });
  },
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
  },
});

export const listChats = query({
  args: {},
  handler: async (ctx) => {
    return await withAuth(ctx, async (userId: string) => {
      return await ctx.db
        .query("chats")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    });
  },
});
