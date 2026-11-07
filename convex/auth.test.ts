import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { requireAdmin, requireUser } from "./auth";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./auth.ts": () => import("./auth"),
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

test("requireUser rejects unauthenticated access", async () => {
  const t = createTest();

  await expect(t.run((ctx) => requireUser(ctx))).rejects.toThrow(
    "No authenticated user",
  );
});

test("requireAdmin rejects unauthenticated access", async () => {
  const t = createTest();

  await expect(t.run((ctx) => requireAdmin(ctx))).rejects.toThrow(
    "No authenticated user",
  );
});

test("requireUser rejects authenticated identities without a user record", async () => {
  const t = createTest();

  await expect(
    t
      .withIdentity({ subject: "user_missing" })
      .run((ctx) => requireUser(ctx)),
  ).rejects.toThrow("User record not found");
});

test("requireAdmin rejects authenticated identities without a user record", async () => {
  const t = createTest();

  await expect(
    t
      .withIdentity({ subject: "user_missing" })
      .run((ctx) => requireAdmin(ctx)),
  ).rejects.toThrow("User record not found");
});

test("requireUser returns the record matching the Clerk identity", async () => {
  const t = createTest();
  const userId = await seedUser(t, "user_ada", "user");

  const user = await t
    .withIdentity({ subject: "user_ada" })
    .run((ctx) => requireUser(ctx));

  expect(user._id).toBe(userId);
  expect(user.clerkId).toBe("user_ada");
});

test("requireAdmin rejects regular users", async () => {
  const t = createTest();
  await seedUser(t, "user_ada", "user");

  await expect(
    t
      .withIdentity({ subject: "user_ada" })
      .run((ctx) => requireAdmin(ctx)),
  ).rejects.toThrow("Admin access required");
});

test("requireAdmin allows admins", async () => {
  const t = createTest();
  const userId = await seedUser(t, "user_admin", "admin");

  const user = await t
    .withIdentity({ subject: "user_admin" })
    .run((ctx) => requireAdmin(ctx));

  expect(user._id).toBe(userId);
  expect(user.role).toBe("admin");
});
