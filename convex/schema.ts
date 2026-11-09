import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    isTrustedLender: v.boolean(),
  })
    .index("by_clerkId", ["clerkId"])
    .searchIndex("search_displayName", {
      searchField: "displayName",
    }),
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
  borrowRequests: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    ownerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled"),
      v.literal("returned"),
    ),
    requestedAt: v.number(),
    decidedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
  })
    .index("by_toolId_and_status_and_endDate", [
      "toolId",
      "status",
      "endDate",
    ])
    .index("by_toolId_and_borrowerId_and_status_and_startDate_and_endDate", [
      "toolId",
      "borrowerId",
      "status",
      "startDate",
      "endDate",
    ])
    .index("by_borrowerId", ["borrowerId"])
    .index("by_borrowerId_and_status", ["borrowerId", "status"])
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_status", ["ownerId", "status"])
    .index("by_status", ["status"]),
});
