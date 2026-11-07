import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./users.ts": () => import("./users"),
};

test("rejects synchronization without an identity and writes nothing", async () => {
  const t = convexTest(schema, modules);

  await expect(t.mutation(api.users.syncCurrentUser)).rejects.toThrow(
    "No authenticated user",
  );
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("rejects synchronization when the subject is missing", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "" });

  await expect(asUser.mutation(api.users.syncCurrentUser)).rejects.toThrow(
    "No authenticated user",
  );
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
});

test("creates a user on first sync with default permission fields", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({
    subject: "user_ada",
    name: "Ada Lovelace",
    pictureUrl: "https://example.com/ada.png",
  });

  const result = await asUser.mutation(api.users.syncCurrentUser);
  const user = await t.run((ctx) => ctx.db.get(result.userId));

  expect(result.clerkId).toBe("user_ada");
  expect(user).toMatchObject({
    clerkId: "user_ada",
    displayName: "Ada Lovelace",
    avatarUrl: "https://example.com/ada.png",
    role: "user",
    isTrustedLender: false,
  });
});

test("falls back to a default name and leaves the avatar unset", async () => {
  const t = convexTest(schema, modules);

  const result = await t
    .withIdentity({ subject: "user_no_profile" })
    .mutation(api.users.syncCurrentUser);
  const user = await t.run((ctx) => ctx.db.get(result.userId));

  expect(result.clerkId).toBe("user_no_profile");
  expect(user?.displayName).toBe("LendLoop User");
  expect(user?.avatarUrl).toBeUndefined();
});

test("updates name and avatar while preserving fields missing from identity", async () => {
  const t = convexTest(schema, modules);
  const { userId } = await t
    .withIdentity({
      subject: "user_ada",
      name: "Ada",
      pictureUrl: "https://example.com/old.png",
    })
    .mutation(api.users.syncCurrentUser);

  await t
    .withIdentity({ subject: "user_ada", name: "Ada Lovelace" })
    .mutation(api.users.syncCurrentUser);
  let user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.displayName).toBe("Ada Lovelace");
  expect(user?.avatarUrl).toBe("https://example.com/old.png");

  await t
    .withIdentity({
      subject: "user_ada",
      pictureUrl: "https://example.com/new.png",
    })
    .mutation(api.users.syncCurrentUser);
  user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.displayName).toBe("Ada Lovelace");
  expect(user?.avatarUrl).toBe("https://example.com/new.png");
});

test("never overwrites role or trusted lender status", async () => {
  const t = convexTest(schema, modules);
  const { userId } = await t
    .withIdentity({ subject: "user_ada", name: "Ada" })
    .mutation(api.users.syncCurrentUser);

  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { role: "admin", isTrustedLender: true });
  });

  await t
    .withIdentity({ subject: "user_ada", name: "Ada Lovelace" })
    .mutation(api.users.syncCurrentUser);

  const user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.role).toBe("admin");
  expect(user?.isTrustedLender).toBe(true);
  expect(user?.displayName).toBe("Ada Lovelace");
});

test("is idempotent across repeated syncs", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ subject: "user_ada", name: "Ada" });

  const first = await asUser.mutation(api.users.syncCurrentUser);
  const second = await asUser.mutation(api.users.syncCurrentUser);

  expect(second).toEqual(first);
  expect(second.clerkId).toBe("user_ada");
  expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
});

test("keeps separate records for separate accounts", async () => {
  const t = convexTest(schema, modules);

  await t
    .withIdentity({ subject: "user_a", name: "A" })
    .mutation(api.users.syncCurrentUser);
  await t
    .withIdentity({ subject: "user_b", name: "B" })
    .mutation(api.users.syncCurrentUser);

  const users = await t.run((ctx) => ctx.db.query("users").collect());
  expect(users.map((user) => user.clerkId).sort()).toEqual([
    "user_a",
    "user_b",
  ]);
});
