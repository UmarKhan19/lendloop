import { internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

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
