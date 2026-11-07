import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthContext = QueryCtx | MutationCtx;

export async function requireUser(ctx: AuthContext): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new ConvexError("No authenticated user");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new ConvexError("User record not found");
  }

  return user;
}

export async function requireAdmin(ctx: AuthContext): Promise<Doc<"users">> {
  const user = await requireUser(ctx);

  if (user.role !== "admin") {
    throw new ConvexError("Admin access required");
  }

  return user;
}
