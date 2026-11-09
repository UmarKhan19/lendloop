import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
  isTrustedLender = false,
) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId,
      displayName: clerkId,
      role,
      isTrustedLender,
    }),
  );
}

async function seedTool(t: TestContext, ownerId: Id<"users">, name: string) {
  return await t.run((ctx) =>
    ctx.db.insert("tools", {
      ownerId,
      name,
      description: `${name} description`,
      category: "Power Tools",
      condition: "good",
      isArchived: false,
    }),
  );
}

const pageArgs = { numItems: 20, cursor: null };

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

test("admin listing and user queries reject unauthenticated and non-admin callers", async () => {
  const t = createTest();
  await seedUser(t, "user_regular");
  await seedUser(t, "user_trusted", "user", true);

  for (const caller of [
    t,
    t.withIdentity({ subject: "user_regular" }),
    t.withIdentity({ subject: "user_trusted" }),
  ]) {
    await expect(
      caller.query(api.admin.listAdminTools, { paginationOpts: pageArgs }),
    ).rejects.toThrow(/No authenticated user|Admin access required/);
    await expect(
      caller.query(api.admin.listAdminUsers, { paginationOpts: pageArgs }),
    ).rejects.toThrow(/No authenticated user|Admin access required/);
  }
});

test("listAdminTools returns active listings with owner details and pagination", async () => {
  const t = createTest();
  const ownerOneId = await seedUser(t, "owner_one");
  const ownerTwoId = await seedUser(t, "owner_two", "user", true);
  await seedUser(t, "user_admin", "admin");
  await seedTool(t, ownerOneId, "Drill");
  await seedTool(t, ownerTwoId, "Ladder");
  await seedTool(t, ownerOneId, "Saw");
  const archivedId = await seedTool(t, ownerOneId, "Archived Sander");
  await t.run((ctx) => ctx.db.patch(archivedId, { isArchived: true }));

  const admin = t.withIdentity({ subject: "user_admin" });
  const first = await admin.query(api.admin.listAdminTools, {
    paginationOpts: { numItems: 2, cursor: null },
  });

  expect(first.page).toHaveLength(2);
  expect(first.isDone).toBe(false);
  expect(first.page.every((tool) => tool.isArchived === false)).toBe(true);

  const second = await admin.query(api.admin.listAdminTools, {
    paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(1);
  expect(second.isDone).toBe(true);

  const tools = [...first.page, ...second.page];
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "Drill",
    "Ladder",
    "Saw",
  ]);
  expect(tools.find((tool) => tool.name === "Ladder")?.owner).toEqual({
    _id: ownerTwoId,
    displayName: "owner_two",
    isTrustedLender: true,
  });
});

test("listAdminUsers searches display names with server-side pagination", async () => {
  const t = createTest();
  await seedUser(t, "user_admin", "admin");
  const names = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Builder One", "Builder Two"];
  for (const name of names) {
    await t.run((ctx) =>
      ctx.db.insert("users", {
        clerkId: `clerk_${name.replaceAll(" ", "_")}`,
        displayName: name,
        role: "user",
        isTrustedLender: false,
      }),
    );
  }

  const admin = t.withIdentity({ subject: "user_admin" });
  const all = await admin.query(api.admin.listAdminUsers, {
    paginationOpts: { numItems: 2, cursor: null },
  });
  expect(all.page).toHaveLength(2);
  expect(all.isDone).toBe(false);

  const searchFirst = await admin.query(api.admin.listAdminUsers, {
    paginationOpts: { numItems: 1, cursor: null },
    search: "Builder",
  });
  expect(searchFirst.page).toHaveLength(1);
  expect(searchFirst.page[0].displayName).toMatch(/^Builder/);
  expect(searchFirst.isDone).toBe(false);

  const searchSecond = await admin.query(api.admin.listAdminUsers, {
    paginationOpts: { numItems: 1, cursor: searchFirst.continueCursor },
    search: "Builder",
  });
  expect(searchSecond.page).toHaveLength(1);
  expect(searchSecond.page[0].displayName).toMatch(/^Builder/);
  expect(searchSecond.isDone).toBe(true);

  const ada = await admin.query(api.admin.listAdminUsers, {
    paginationOpts: pageArgs,
    search: "Ada",
  });
  expect(ada.page.map((user) => user.displayName)).toEqual(["Ada Lovelace"]);
});

test("granting and revoking Trusted Lender is admin-only and idempotent", async () => {
  const t = createTest();
  const memberId = await seedUser(t, "user_member");
  await seedUser(t, "user_trusted", "user", true);
  await seedUser(t, "user_admin", "admin");

  const admin = t.withIdentity({ subject: "user_admin" });
  const grant = await admin.mutation(api.admin.grantTrustedLender, {
    userId: memberId,
  });
  expect(grant).toEqual({
    userId: memberId,
    isTrustedLender: true,
    changed: true,
  });
  expect(await t.run((ctx) => ctx.db.get(memberId))).toMatchObject({
    role: "user",
    isTrustedLender: true,
  });

  const repeatGrant = await admin.mutation(api.admin.grantTrustedLender, {
    userId: memberId,
  });
  expect(repeatGrant).toEqual({
    userId: memberId,
    isTrustedLender: true,
    changed: false,
  });

  const revoke = await admin.mutation(api.admin.revokeTrustedLender, {
    userId: memberId,
  });
  expect(revoke).toEqual({
    userId: memberId,
    isTrustedLender: false,
    changed: true,
  });

  const repeatRevoke = await admin.mutation(api.admin.revokeTrustedLender, {
    userId: memberId,
  });
  expect(repeatRevoke).toEqual({
    userId: memberId,
    isTrustedLender: false,
    changed: false,
  });
  expect(await t.run((ctx) => ctx.db.get(memberId))).toMatchObject({
    role: "user",
    isTrustedLender: false,
  });
});

test("regular and trusted users cannot change Trusted Lender status", async () => {
  const t = createTest();
  const memberId = await seedUser(t, "user_member");
  await seedUser(t, "user_trusted", "user", true);

  for (const caller of [
    t,
    t.withIdentity({ subject: "user_member" }),
    t.withIdentity({ subject: "user_trusted" }),
  ]) {
    await expect(
      caller.mutation(api.admin.grantTrustedLender, { userId: memberId }),
    ).rejects.toThrow(/No authenticated user|Admin access required/);
    await expect(
      caller.mutation(api.admin.revokeTrustedLender, { userId: memberId }),
    ).rejects.toThrow(/No authenticated user|Admin access required/);
  }

  expect(await t.run((ctx) => ctx.db.get(memberId))).toMatchObject({
    isTrustedLender: false,
  });
});

test("trust updates do not promote users and reject unknown user IDs", async () => {
  const t = createTest();
  const memberId = await seedUser(t, "user_member");
  await seedUser(t, "user_admin", "admin");
  const admin = t.withIdentity({ subject: "user_admin" });

  await admin.mutation(api.admin.grantTrustedLender, { userId: memberId });
  expect(await t.run((ctx) => ctx.db.get(memberId))).toMatchObject({
    role: "user",
    isTrustedLender: true,
  });

  const missingId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "user_missing",
      displayName: "Missing",
      role: "user",
      isTrustedLender: false,
    }),
  );
  await t.run((ctx) => ctx.db.delete(missingId));

  await expect(
    admin.mutation(api.admin.grantTrustedLender, { userId: missingId }),
  ).rejects.toThrow("User not found");
});

test("admin role does not imply Trusted Lender status", async () => {
  const t = createTest();
  const adminId = await seedUser(t, "user_admin", "admin", false);
  const admin = t.withIdentity({ subject: "user_admin" });

  const result = await admin.query(api.admin.listAdminUsers, {
    paginationOpts: pageArgs,
  });

  expect(result.page.find((user) => user._id === adminId)).toMatchObject({
    role: "admin",
    isTrustedLender: false,
  });
});
