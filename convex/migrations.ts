import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { activeTools } from "./toolAggregates";

// Manual, idempotent migration for listings created before aggregates existed.
// Run after deploying the aggregate code:
//   npx convex run migrations:backfillToolAggregate
// Add `--prod` to target production when you are ready.
export const backfillToolAggregateBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.max(1, Math.min(args.numItems ?? 100, 100));
    const result = await ctx.db
      .query("tools")
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .paginate({ cursor: args.cursor, numItems });

    for (const tool of result.page) {
      await activeTools.insertIfDoesNotExist(ctx, tool);
    }

    return {
      processed: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const backfillToolAggregate = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    batches: v.number(),
  }),
  handler: async (ctx) => {
    let cursor: string | null = null;
    let processed = 0;
    let batches = 0;
    let isDone = false;

    while (!isDone) {
      const result: {
        processed: number;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runMutation(
        internal.migrations.backfillToolAggregateBatch,
        { cursor, numItems: 100 },
      );
      processed += result.processed;
      batches += 1;
      cursor = result.continueCursor;
      isDone = result.isDone;
    }

    return { processed, batches };
  },
});
