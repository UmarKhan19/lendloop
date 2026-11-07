import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      subject: v.string(),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;

    return {
      subject: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
    };
  },
});

export const syncCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new ConvexError("No authenticated user");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      const name = identity.name;
      const avatarUrl = identity.pictureUrl;

      if (name || avatarUrl) {
        await ctx.db.patch(existing._id, {
          ...(name ? { displayName: name } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        });
      }

      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      displayName: identity.name || "LendLoop User",
      ...(identity.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
      role: "user",
      isTrustedLender: false,
    });
  },
});
