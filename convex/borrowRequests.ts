import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./auth";
import { validateBorrowDates } from "./borrowDates";
import { findApprovedOverlap } from "./toolAvailability";

const borrowStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

const borrowRequestFields = {
  _id: v.id("borrowRequests"),
  _creationTime: v.number(),
  toolId: v.id("tools"),
  borrowerId: v.id("users"),
  ownerId: v.id("users"),
  startDate: v.string(),
  endDate: v.string(),
  status: borrowStatusValidator,
  requestedAt: v.number(),
  decidedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  returnedAt: v.optional(v.number()),
};

const toolSummaryValidator = v.object({
  _id: v.id("tools"),
  name: v.string(),
  category: v.string(),
  isArchived: v.boolean(),
});

const userSummaryValidator = v.object({
  _id: v.id("users"),
  displayName: v.string(),
});

const borrowRequestDetailsValidator = v.object({
  ...borrowRequestFields,
  tool: v.union(toolSummaryValidator, v.null()),
  borrower: v.union(userSummaryValidator, v.null()),
  owner: v.union(userSummaryValidator, v.null()),
});

type ReadContext = QueryCtx | MutationCtx;

async function enrichBorrowRequest(
  ctx: ReadContext,
  request: Doc<"borrowRequests">,
) {
  const [tool, borrower, owner] = await Promise.all([
    ctx.db.get(request.toolId),
    ctx.db.get(request.borrowerId),
    ctx.db.get(request.ownerId),
  ]);

  return {
    ...request,
    tool: tool
      ? {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          isArchived: tool.isArchived,
        }
      : null,
    borrower: borrower
      ? { _id: borrower._id, displayName: borrower.displayName }
      : null,
    owner: owner
      ? { _id: owner._id, displayName: owner.displayName }
      : null,
  };
}

async function enrichBorrowRequests(
  ctx: ReadContext,
  requests: Doc<"borrowRequests">[],
) {
  return await Promise.all(
    requests.map((request) => enrichBorrowRequest(ctx, request)),
  );
}

// Pending requests do not reserve dates. Only approved requests do, and they
// keep reserving them until the owner marks the loan returned.
async function assertDatesAvailable(
  ctx: ReadContext,
  toolId: Id<"tools">,
  startDate: string,
  endDate: string,
) {
  const conflict = await findApprovedOverlap(ctx, toolId, startDate, endDate);
  if (conflict) {
    throw new ConvexError("Tool is not available for the requested dates");
  }
}

function isParticipant(
  request: Doc<"borrowRequests">,
  userId: Id<"users">,
): boolean {
  return request.borrowerId === userId || request.ownerId === userId;
}

export const createBorrowRequest = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.id("borrowRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new ConvexError("Tool listing not found");
    }
    if (tool.isArchived) {
      throw new ConvexError("Archived tool listings cannot be borrowed");
    }
    if (tool.ownerId === user._id) {
      throw new ConvexError("You cannot request your own tool");
    }

    validateBorrowDates(args.startDate, args.endDate);

    const duplicate = await ctx.db
      .query("borrowRequests")
      .withIndex(
        "by_toolId_and_borrowerId_and_status_and_startDate_and_endDate",
        (q) =>
          q
            .eq("toolId", args.toolId)
            .eq("borrowerId", user._id)
            .eq("status", "pending")
            .eq("startDate", args.startDate)
            .eq("endDate", args.endDate),
      )
      .first();

    if (duplicate) {
      throw new ConvexError(
        "You already have a pending request for these dates",
      );
    }

    // This check is repeated inside approveBorrowRequest because availability
    // can change while the request waits for the owner's decision.
    await assertDatesAvailable(ctx, args.toolId, args.startDate, args.endDate);

    return await ctx.db.insert("borrowRequests", {
      toolId: tool._id,
      borrowerId: user._id,
      ownerId: tool.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      requestedAt: Date.now(),
    });
  },
});

export const approveBorrowRequest = mutation({
  args: {
    requestId: v.id("borrowRequests"),
  },
  returns: v.id("borrowRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new ConvexError("Borrow request not found");
    }
    if (request.ownerId !== user._id) {
      throw new ConvexError("Only the tool owner can approve this request");
    }
    if (request.status !== "pending") {
      throw new ConvexError("Only pending requests can be approved");
    }

    const tool = await ctx.db.get(request.toolId);
    if (!tool) {
      throw new ConvexError("Tool listing not found");
    }
    if (tool.isArchived) {
      throw new ConvexError("Archived tool listings cannot be approved");
    }

    // Dates can expire while a request is pending, so validate again here.
    validateBorrowDates(request.startDate, request.endDate);

    // The availability read and the approval write happen in this same
    // serializable mutation. Concurrent approvals that would overlap therefore
    // conflict and Convex retries one of them, where this check sees the
    // committed approval and rejects it.
    await assertDatesAvailable(
      ctx,
      request.toolId,
      request.startDate,
      request.endDate,
    );

    await ctx.db.patch(request._id, {
      status: "approved",
      decidedAt: Date.now(),
    });

    return request._id;
  },
});

export const declineBorrowRequest = mutation({
  args: {
    requestId: v.id("borrowRequests"),
  },
  returns: v.id("borrowRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new ConvexError("Borrow request not found");
    }
    if (request.ownerId !== user._id) {
      throw new ConvexError("Only the tool owner can decline this request");
    }
    if (request.status !== "pending") {
      throw new ConvexError("Only pending requests can be declined");
    }

    await ctx.db.patch(request._id, {
      status: "declined",
      decidedAt: Date.now(),
    });

    return request._id;
  },
});

export const cancelBorrowRequest = mutation({
  args: {
    requestId: v.id("borrowRequests"),
  },
  returns: v.id("borrowRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new ConvexError("Borrow request not found");
    }
    if (request.borrowerId !== user._id) {
      throw new ConvexError("Only the borrower can cancel this request");
    }
    if (request.status !== "pending") {
      throw new ConvexError("Only pending requests can be cancelled");
    }

    await ctx.db.patch(request._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    return request._id;
  },
});

export const markBorrowRequestReturned = mutation({
  args: {
    requestId: v.id("borrowRequests"),
  },
  returns: v.id("borrowRequests"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new ConvexError("Borrow request not found");
    }
    if (request.ownerId !== user._id) {
      throw new ConvexError("Only the tool owner can mark this loan returned");
    }
    if (request.status !== "approved") {
      throw new ConvexError("Only approved loans can be marked returned");
    }

    // Deliberately allowed even when the tool is archived: an existing loan
    // must remain returnable so its history stays complete.
    await ctx.db.patch(request._id, {
      status: "returned",
      returnedAt: Date.now(),
    });

    return request._id;
  },
});

export const listOutgoingRequests = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(borrowStatusValidator),
  },
  returns: paginationResultValidator(borrowRequestDetailsValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const status = args.status;

    const result =
      status !== undefined
        ? await ctx.db
            .query("borrowRequests")
            .withIndex("by_borrowerId_and_status", (q) =>
              q.eq("borrowerId", user._id).eq("status", status),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("borrowRequests")
            .withIndex("by_borrowerId", (q) => q.eq("borrowerId", user._id))
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichBorrowRequests(ctx, result.page),
    };
  },
});

export const listIncomingRequests = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(borrowStatusValidator),
  },
  returns: paginationResultValidator(borrowRequestDetailsValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const status = args.status;

    const result =
      status !== undefined
        ? await ctx.db
            .query("borrowRequests")
            .withIndex("by_ownerId_and_status", (q) =>
              q.eq("ownerId", user._id).eq("status", status),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("borrowRequests")
            .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichBorrowRequests(ctx, result.page),
    };
  },
});

export const getBorrowRequest = query({
  args: {
    requestId: v.string(),
  },
  returns: v.union(borrowRequestDetailsValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const requestId = ctx.db.normalizeId("borrowRequests", args.requestId);

    if (!requestId) {
      return null;
    }

    const request = await ctx.db.get(requestId);
    if (!request) {
      return null;
    }
    if (!isParticipant(request, user._id) && user.role !== "admin") {
      throw new ConvexError("You do not have access to this borrow request");
    }

    return await enrichBorrowRequest(ctx, request);
  },
});

export const checkToolAvailability = query({
  args: {
    toolId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const toolId = ctx.db.normalizeId("tools", args.toolId);
    if (!toolId) {
      return false;
    }

    validateBorrowDates(args.startDate, args.endDate);

    const tool = await ctx.db.get(toolId);
    if (!tool || tool.isArchived) {
      return false;
    }

    return (await findApprovedOverlap(
      ctx,
      toolId,
      args.startDate,
      args.endDate,
    )) === null;
  },
});

// Admin view of every borrow request. "Loans" here includes pending,
// declined, cancelled, and returned history; use the status filter for a
// specific lifecycle stage.
export const listAllLoans = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(borrowStatusValidator),
  },
  returns: paginationResultValidator(borrowRequestDetailsValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status;

    const result =
      status !== undefined
        ? await ctx.db
            .query("borrowRequests")
            .withIndex("by_status", (q) => q.eq("status", status))
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("borrowRequests")
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichBorrowRequests(ctx, result.page),
    };
  },
});
