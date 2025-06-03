import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_creation_time")
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    text: v.string(),
    senderId: v.id("users"),
    senderName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      text: args.text,
      senderId: args.senderId,
      senderName: args.senderName,
    });
  },
});