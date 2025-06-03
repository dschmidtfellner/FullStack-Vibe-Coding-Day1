import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema defines your data model for the database.
// For more information, see https://docs.convex.dev/database/schema
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
  }).index("by_clerkId", ["clerkId"]),
  
  messages: defineTable({
    text: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    audioId: v.optional(v.id("_storage")),
    senderId: v.id("users"),
    senderName: v.string(),
    type: v.optional(v.union(v.literal("text"), v.literal("image"), v.literal("audio"))),
  }),
});
