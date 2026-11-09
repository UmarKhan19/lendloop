import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type ReadContext = QueryCtx | MutationCtx;

// Inclusive overlap for one tool: startA <= endB && endA >= startB.
// The index narrows to approved loans that end on or after the requested
// start. The database filter applies the other half of the condition, and
// first() stops as soon as one conflict is found. There is deliberately no
// take() limit here: an availability check must see every possible conflict.
export async function findApprovedOverlap(
  ctx: ReadContext,
  toolId: Id<"tools">,
  startDate: string,
  endDate: string,
): Promise<Doc<"borrowRequests"> | null> {
  return await ctx.db
    .query("borrowRequests")
    .withIndex("by_toolId_and_status_and_endDate", (q) =>
      q
        .eq("toolId", toolId)
        .eq("status", "approved")
        .gte("endDate", startDate),
    )
    .filter((q) => q.lte(q.field("startDate"), endDate))
    .first();
}

export async function findApprovedReservationCoveringDate(
  ctx: ReadContext,
  toolId: Id<"tools">,
  date: string,
): Promise<Doc<"borrowRequests"> | null> {
  return await findApprovedOverlap(ctx, toolId, date, date);
}
