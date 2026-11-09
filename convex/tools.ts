import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import {
  formatDateOnly,
  parseDateOnly,
  todayUtcDay,
} from "./borrowDates";
import { findApprovedReservationCoveringDate } from "./toolAvailability";
import { activeTools } from "./toolAggregates";
import { TOOL_CATEGORIES, TOOL_CONDITIONS } from "./toolOptions";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2_000;
const PUBLIC_PREVIEW_LIMIT = 6;

// Each candidate costs one indexed reservation lookup. Convex allows 4,096
// index ranges and 32,000 scanned documents per query, so 100 candidates (plus
// the single tools read) stays far below both limits. The budget is also a
// useful latency bound for a homepage preview. If the newest 100 active tools
// are all unavailable, the preview returns fewer than six rather than showing
// an unverified tool.
export const PUBLIC_AVAILABILITY_CANDIDATE_BUDGET = 100;

const categoryValidator = v.union(
  ...TOOL_CATEGORIES.map((category) => v.literal(category)),
);

const conditionValidator = v.union(
  ...TOOL_CONDITIONS.map((condition) => v.literal(condition)),
);

const toolValidator = v.object({
  _id: v.id("tools"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  name: v.string(),
  description: v.string(),
  category: v.string(),
  condition: conditionValidator,
  isArchived: v.boolean(),
});

const publicToolValidator = v.object({
  name: v.string(),
  category: v.string(),
});

function cleanText(value: string, label: string, maxLength: number): string {
  const cleaned = value.trim();
  if (cleaned.length === 0) {
    throw new ConvexError(`${label} is required`);
  }
  if (cleaned.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer`);
  }
  return cleaned;
}

// Public: the homepage may only see names and categories of a small preview.
// A tool is available when it is not archived and no approved reservation
// covers the current UTC calendar day.
export const listPublicTools = query({
  args: {
    // Only a reactive identity token. The backend deliberately ignores its
    // value when deciding what "today" is, so a manipulated client date can
    // never expose a tool reserved for the server's current day.
    refreshDate: v.string(),
  },
  returns: v.array(publicToolValidator),
  handler: async (ctx, args) => {
    if (parseDateOnly(args.refreshDate) === null) {
      throw new ConvexError(
        "refreshDate must be a valid date in YYYY-MM-DD format",
      );
    }

    const today = formatDateOnly(todayUtcDay());

    const candidates = await ctx.db
      .query("tools")
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .order("desc")
      .take(PUBLIC_AVAILABILITY_CANDIDATE_BUDGET);

    const preview: { name: string; category: string }[] = [];
    for (const tool of candidates) {
      const reservation = await findApprovedReservationCoveringDate(
        ctx,
        tool._id,
        today,
      );
      if (reservation) continue;

      preview.push({ name: tool.name, category: tool.category });
      if (preview.length === PUBLIC_PREVIEW_LIMIT) break;
    }

    return preview;
  },
});

export const getActiveToolCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return await activeTools.count(ctx);
  },
});

export const listTools = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(categoryValidator),
  },
  returns: paginationResultValidator(toolValidator),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const category = args.category;

    if (category !== undefined) {
      return await ctx.db
        .query("tools")
        .withIndex("by_isArchived_and_category", (q) =>
          q.eq("isArchived", false).eq("category", category),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("tools")
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const listMyTools = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(toolValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    return await ctx.db
      .query("tools")
      .withIndex("by_ownerId_and_isArchived", (q) =>
        q.eq("ownerId", user._id).eq("isArchived", false),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const countMyActiveTools = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await activeTools.count(ctx, {
      bounds: { prefix: [user._id] },
    });
  },
});

export const getTool = query({
  args: {
    toolId: v.string(),
  },
  returns: v.union(toolValidator, v.null()),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const toolId = ctx.db.normalizeId("tools", args.toolId);
    if (!toolId) {
      return null;
    }

    const tool = await ctx.db.get(toolId);
    if (!tool || tool.isArchived) {
      return null;
    }

    return tool;
  },
});

export const isToolOwner = query({
  args: {
    toolId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const toolId = ctx.db.normalizeId("tools", args.toolId);
    if (!toolId) {
      return false;
    }

    const tool = await ctx.db.get(toolId);
    return Boolean(tool && !tool.isArchived && tool.ownerId === user._id);
  },
});

export const createTool = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: categoryValidator,
    condition: conditionValidator,
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const toolId = await ctx.db.insert("tools", {
      ownerId: user._id,
      name: cleanText(args.name, "Name", MAX_NAME_LENGTH),
      description: cleanText(
        args.description,
        "Description",
        MAX_DESCRIPTION_LENGTH,
      ),
      category: args.category,
      condition: args.condition,
      isArchived: false,
    });

    const tool = await ctx.db.get(toolId);
    if (!tool) {
      throw new ConvexError("Could not create tool listing");
    }
    await activeTools.insertIfDoesNotExist(ctx, tool);

    return toolId;
  },
});

export const updateTool = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryValidator),
    condition: v.optional(conditionValidator),
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new ConvexError("Tool listing not found");
    }
    if (tool.ownerId !== user._id) {
      throw new ConvexError("You can only edit your own tool listings");
    }
    if (tool.isArchived) {
      throw new ConvexError("Archived tool listings cannot be edited");
    }

    const patch: Partial<
      Pick<Doc<"tools">, "name" | "description" | "category" | "condition">
    > = {};

    if (args.name !== undefined) {
      patch.name = cleanText(args.name, "Name", MAX_NAME_LENGTH);
    }
    if (args.description !== undefined) {
      patch.description = cleanText(
        args.description,
        "Description",
        MAX_DESCRIPTION_LENGTH,
      );
    }
    if (args.category !== undefined) {
      patch.category = args.category;
    }
    if (args.condition !== undefined) {
      patch.condition = args.condition;
    }
    if (Object.keys(patch).length === 0) {
      throw new ConvexError("No fields to update");
    }

    await ctx.db.patch(tool._id, patch);
    return tool._id;
  },
});

// Soft delete: the document stays in place so future borrow records keep a
// valid reference, but it is hidden from public and authenticated listings.
export const deleteTool = mutation({
  args: {
    toolId: v.id("tools"),
  },
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new ConvexError("Tool listing not found");
    }
    if (tool.ownerId !== user._id && user.role !== "admin") {
      throw new ConvexError("You can only delete your own tool listings");
    }

    if (!tool.isArchived) {
      await ctx.db.patch(tool._id, { isArchived: true });
      await activeTools.deleteIfExists(ctx, tool);
    }

    return tool._id;
  },
});
