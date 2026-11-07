import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./admin.ts": () => import("./admin"),
};

function createTest() {
  return convexTest(schema, modules);
}

type TestContext = ReturnType<typeof createTest>;

async function seedUser(
  t: TestContext,
  clerkId: string,
  role: "user" | "admin" = "user",
) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId,
      displayName: clerkId,
      role,
      isTrustedLender: false,
    }),
  );
}

test("promoteToAdmin promotes the matching user by Clerk ID", async () => {
  const t = createTest();
  const userId = await seedUser(t, "user_new_admin");
  const otherUserId = await seedUser(t, "user_other");

  const result = await t.mutation(internal.admin.promoteToAdmin, {
    clerkId: "user_new_admin",
  });

  expect(result).toEqual({ userId, alreadyAdmin: false });
  expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
    clerkId: "user_new_admin",
    role: "admin",
  });
  expect(await t.run((ctx) => ctx.db.get(otherUserId))).toMatchObject({
    role: "user",
  });
});

test("promoteToAdmin rejects nonexistent users", async () => {
  const t = createTest();

  await expect(
    t.mutation(internal.admin.promoteToAdmin, {
      clerkId: "user_missing",
    }),
  ).rejects.toThrow('No user found with Clerk ID "user_missing"');
});

test("promoteToAdmin does not rewrite users who are already admins", async () => {
  const t = createTest();
  const userId = await seedUser(t, "user_admin", "admin");

  const result = await t.mutation(internal.admin.promoteToAdmin, {
    clerkId: "user_admin",
  });

  expect(result).toEqual({ userId, alreadyAdmin: true });
  expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
    role: "admin",
  });
});
