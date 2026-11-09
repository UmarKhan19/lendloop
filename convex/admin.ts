import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { TOOL_CONDITIONS } from "./toolOptions";

const roleValidator = v.union(v.literal("user"), v.literal("admin"));

const conditionValidator = v.union(
  ...TOOL_CONDITIONS.map((condition) => v.literal(condition)),
);

const adminToolValidator = v.object({
  _id: v.id("tools"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  name: v.string(),
  description: v.string(),
  category: v.string(),
  condition: conditionValidator,
  isArchived: v.boolean(),
  owner: v.union(
    v.object({
      _id: v.id("users"),
      displayName: v.string(),
      isTrustedLender: v.boolean(),
    }),
    v.null(),
  ),
});

const adminUserValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  displayName: v.string(),
  role: roleValidator,
  isTrustedLender: v.boolean(),
});

const trustedLenderResultValidator = v.object({
  userId: v.id("users"),
  isTrustedLender: v.boolean(),
  changed: v.boolean(),
});

const MAX_USER_SEARCH_LENGTH = 100;

function toAdminUser(user: {
  _id: Id<"users">;
  _creationTime: number;
  displayName: string;
  role: "user" | "admin";
  isTrustedLender: boolean;
}) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    displayName: user.displayName,
    role: user.role,
    isTrustedLender: user.isTrustedLender,
  };
}

// Bootstrap-only: internal so it cannot be called from the frontend, and
// intentionally unauthenticated so the first admin can be created via the CLI.
export const promoteToAdmin = internalMutation({
  args: {
    clerkId: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    alreadyAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new ConvexError(`No user found with Clerk ID "${args.clerkId}"`);
    }

    if (user.role === "admin") {
      return { userId: user._id, alreadyAdmin: true };
    }

    await ctx.db.patch(user._id, { role: "admin" });
    return { userId: user._id, alreadyAdmin: false };
  },
});

// Admin moderation view: active listings only, newest first. Archived tools
// intentionally disappear from this list while remaining in borrowing history.
export const listAdminTools = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(adminToolValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const result = await ctx.db
      .query("tools")
      .withIndex("by_isArchived", (q) => q.eq("isArchived", false))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          ...tool,
          owner: owner
            ? {
                _id: owner._id,
                displayName: owner.displayName,
                isTrustedLender: owner.isTrustedLender,
              }
            : null,
        };
      }),
    );

    return { ...result, page };
  },
});

export const listAdminUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
  },
  returns: paginationResultValidator(adminUserValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const search = args.search?.trim() ?? "";
    if (search.length > MAX_USER_SEARCH_LENGTH) {
      throw new ConvexError(
        `Search must be ${MAX_USER_SEARCH_LENGTH} characters or fewer`,
      );
    }

    if (search.length > 0) {
      const result = await ctx.db
        .query("users")
        .withSearchIndex("search_displayName", (q) =>
          q.search("displayName", search),
        )
        .paginate(args.paginationOpts);

      return { ...result, page: result.page.map(toAdminUser) };
    }

    const result = await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);

    return { ...result, page: result.page.map(toAdminUser) };
  },
});

async function setTrustedLenderStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  isTrustedLender: boolean,
) {
  await requireAdmin(ctx);

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("User not found");
  }

  const changed = user.isTrustedLender !== isTrustedLender;
  if (changed) {
    await ctx.db.patch(user._id, { isTrustedLender });
  }

  return { userId: user._id, isTrustedLender, changed };
}

// Repeating either operation is a no-op, so the client can retry safely.
export const grantTrustedLender = mutation({
  args: { userId: v.id("users") },
  returns: trustedLenderResultValidator,
  handler: async (ctx, args) => {
    return await setTrustedLenderStatus(ctx, args.userId, true);
  },
});

export const revokeTrustedLender = mutation({
  args: { userId: v.id("users") },
  returns: trustedLenderResultValidator,
  handler: async (ctx, args) => {
    return await setTrustedLenderStatus(ctx, args.userId, false);
  },
});
