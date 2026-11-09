import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    isTrustedLender: v.boolean(),
  }).index("by_clerkId", ["clerkId"]),
  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    condition: v.union(
      v.literal("new"),
      v.literal("like_new"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("poor"),
    ),
    isArchived: v.boolean(),
  })
    .index("by_ownerId_and_isArchived", ["ownerId", "isArchived"])
    .index("by_isArchived", ["isArchived"])
    .index("by_isArchived_and_category", ["isArchived", "category"]),
});
