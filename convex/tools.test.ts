import { expect, setSystemTime, test } from "bun:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { formatDateOnly, todayUtcDay } from "./borrowDates";
import schema from "./schema";
import { PUBLIC_AVAILABILITY_CANDIDATE_BUDGET } from "./tools";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./tools.ts": () => import("./tools"),
  "./borrowRequests.ts": () => import("./borrowRequests"),
  "./admin.ts": () => import("./admin"),
  "./migrations.ts": () => import("./migrations"),
};

type TestContext = ReturnType<typeof convexTest>;

async function registerAggregate(t: TestContext) {
  // The component's /test helper uses Vite's import.meta.glob, which Bun does
  // not implement, so register its compiled modules directly instead.
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("@convex-dev/aggregate/package.json");
  const componentDir = join(dirname(packageJson), "dist/component");
  const schemaModule = await import(
    pathToFileURL(join(componentDir, "schema.js")).href
  );
  const files = [
    "_generated/api",
    "public",
    "worker",
    "btree",
    "inspect",
    "deadLetter",
    "schema",
  ];
  const componentModules = Object.fromEntries(
    files.map((file) => [
      `./${file}.js`,
      () => import(pathToFileURL(join(componentDir, `${file}.js`)).href),
    ]),
  );

  t.registerComponent("aggregate", schemaModule.default, componentModules);
}

async function createTest() {
  const t = convexTest(schema, modules);
  await registerAggregate(t);
  return t;
}

type AsyncTestContext = Awaited<ReturnType<typeof createTest>>;

type ToolFields = Pick<
  Doc<"tools">,
  "name" | "description" | "category" | "condition" | "isArchived"
>;

const validToolInput = {
  name: "Cordless Drill",
  description: "18V drill with two batteries",
  category: "Power Tools",
  condition: "good",
} as const;

const validTool: ToolFields = {
  ...validToolInput,
  isArchived: false,
};

const pageArgs = { numItems: 20, cursor: null };

async function seedUser(
  t: AsyncTestContext,
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

async function seedTool(
  t: AsyncTestContext,
  ownerId: Id<"users">,
  overrides: Partial<ToolFields> = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("tools", {
      ownerId,
      ...validTool,
      ...overrides,
    }),
  );
}

async function seedTools(
  t: AsyncTestContext,
  ownerId: Id<"users">,
  count: number,
  fields: (index: number) => Partial<ToolFields>,
) {
  const ids: Id<"tools">[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(await seedTool(t, ownerId, fields(index)));
  }
  return ids;
}

function dateFromToday(offset: number) {
  return formatDateOnly(todayUtcDay() + offset);
}

function publicQueryArgs(refreshDate = dateFromToday(0)) {
  return { refreshDate };
}

async function seedBorrowRequest(
  t: AsyncTestContext,
  fields: {
    toolId: Id<"tools">;
    ownerId: Id<"users">;
    borrowerId: Id<"users">;
    startDate: string;
    endDate: string;
    status: Doc<"borrowRequests">["status"];
  },
) {
  return await t.run((ctx) =>
    ctx.db.insert("borrowRequests", {
      ...fields,
      requestedAt: Date.now(),
    }),
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

test("createTool rejects unauthenticated access and writes nothing", async () => {
  const t = await createTest();

  await expect(t.mutation(api.tools.createTool, validToolInput)).rejects.toThrow(
    "No authenticated user",
  );
  expect(await t.run((ctx) => ctx.db.query("tools").collect())).toEqual([]);
  expect(await t.query(api.tools.getActiveToolCount)).toBe(0);
});

test("createTool rejects authenticated identities without a user record", async () => {
  const t = await createTest();

  await expect(
    t
      .withIdentity({ subject: "user_missing" })
      .mutation(api.tools.createTool, validToolInput),
  ).rejects.toThrow("User record not found");
});

test("createTool derives ownership from the caller and trims input", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");

  const toolId = await t
    .withIdentity({ subject: "user_owner" })
    .mutation(api.tools.createTool, {
      name: "  Cordless Drill  ",
      description: "  18V drill with two batteries  ",
      category: "Power Tools",
      condition: "good",
    });
  const tool = await t.run((ctx) => ctx.db.get(toolId));

  expect(tool).toMatchObject({
    ownerId: userId,
    name: "Cordless Drill",
    description: "18V drill with two batteries",
    category: "Power Tools",
    condition: "good",
    isArchived: false,
  });
});

test("createTool rejects empty and oversized fields", async () => {
  const t = await createTest();
  await seedUser(t, "user_owner");
  const asUser = t.withIdentity({ subject: "user_owner" });

  await expect(
    asUser.mutation(api.tools.createTool, { ...validToolInput, name: "   " }),
  ).rejects.toThrow("Name is required");
  await expect(
    asUser.mutation(api.tools.createTool, {
      ...validToolInput,
      description: "",
    }),
  ).rejects.toThrow("Description is required");
  await expect(
    asUser.mutation(api.tools.createTool, {
      ...validToolInput,
      name: "x".repeat(101),
    }),
  ).rejects.toThrow("Name must be 100 characters or fewer");
});

test("createTool only accepts predefined categories", async () => {
  const t = await createTest();
  await seedUser(t, "user_owner");
  const asUser = t.withIdentity({ subject: "user_owner" });

  await expect(
    asUser.mutation(api.tools.createTool, {
      ...validToolInput,
      category: "Power tools",
    } as never),
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.query("tools").collect())).toEqual([]);
});

test("listTools requires authentication", async () => {
  const t = await createTest();

  await expect(
    t.query(api.tools.listTools, { paginationOpts: pageArgs }),
  ).rejects.toThrow("No authenticated user");
});

test("listTools returns active listings and filters by category", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");

  await seedTool(t, userId, { ...validTool, name: "Cordless Drill" });
  await seedTool(t, userId, {
    name: "Garden Ladder",
    description: "Aluminium step ladder",
    category: "Gardening",
    condition: "fair",
  });
  await seedTool(t, userId, {
    ...validTool,
    name: "Old Hammer",
    category: "Hand Tools",
    isArchived: true,
  });

  const asUser = t.withIdentity({ subject: "user_owner" });

  const allTools = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
  });
  expect(allTools.page.map((tool) => tool.name).sort()).toEqual([
    "Cordless Drill",
    "Garden Ladder",
  ]);

  const powerTools = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
    category: "Power Tools",
  });
  expect(powerTools.page.map((tool) => tool.name)).toEqual([
    "Cordless Drill",
  ]);

  const gardenTools = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
    category: "Gardening",
  });
  expect(gardenTools.page.map((tool) => tool.name)).toEqual([
    "Garden Ladder",
  ]);
});

test("listTools rejects categories outside the predefined list", async () => {
  const t = await createTest();
  await seedUser(t, "user_owner");

  await expect(
    t
      .withIdentity({ subject: "user_owner" })
      .query(api.tools.listTools, {
        paginationOpts: pageArgs,
        category: "Power tools",
      } as never),
  ).rejects.toThrow();
});

test("listTools paginates newest first", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");

  for (let index = 0; index < 23; index += 1) {
    await sleep(2);
    await seedTool(t, userId, { ...validTool, name: `Paged Tool ${index}` });
  }

  const asUser = t.withIdentity({ subject: "user_owner" });
  const first = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
  });

  expect(first.page).toHaveLength(20);
  expect(first.isDone).toBe(false);
  expect(first.page[0].name).toBe("Paged Tool 22");

  const second = await asUser.query(api.tools.listTools, {
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });

  expect(second.page).toHaveLength(3);
  expect(second.isDone).toBe(true);
  expect(second.page.map((tool) => tool.name)).toEqual([
    "Paged Tool 2",
    "Paged Tool 1",
    "Paged Tool 0",
  ]);
});

test("listTools keeps category filtering across pages", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");

  await seedTools(t, userId, 22, (index) => ({
    ...validTool,
    name: `Power Tool ${index}`,
  }));
  await seedTool(t, userId, {
    ...validTool,
    name: "Garden Tool",
    category: "Gardening",
  });

  const asUser = t.withIdentity({ subject: "user_owner" });
  const first = await asUser.query(api.tools.listTools, {
    paginationOpts: { numItems: 10, cursor: null },
    category: "Power Tools",
  });
  expect(first.page).toHaveLength(10);
  expect(first.isDone).toBe(false);
  expect(first.page.every((tool) => tool.category === "Power Tools")).toBe(true);

  const second = await asUser.query(api.tools.listTools, {
    paginationOpts: { numItems: 10, cursor: first.continueCursor },
    category: "Power Tools",
  });
  expect(second.page).toHaveLength(10);
  expect(second.isDone).toBe(false);

  const third = await asUser.query(api.tools.listTools, {
    paginationOpts: { numItems: 10, cursor: second.continueCursor },
    category: "Power Tools",
  });
  expect(third.page).toHaveLength(2);
  expect(third.isDone).toBe(true);
  expect(third.page.every((tool) => tool.category === "Power Tools")).toBe(true);
});

test("listPublicTools exposes only a limited names/categories preview", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");

  await seedTools(t, userId, 8, (index) => ({
    ...validTool,
    name: `Preview Tool ${index}`,
  }));
  await seedTool(t, userId, {
    ...validTool,
    name: "Archived Tool",
    isArchived: true,
  });

  const publicTools = await t.query(api.tools.listPublicTools, publicQueryArgs());

  expect(publicTools).toHaveLength(6);
  expect(publicTools.map((tool) => tool.name)).not.toContain("Archived Tool");
  expect(Object.keys(publicTools[0]).sort()).toEqual(["category", "name"]);
});

test("listPublicTools hides only tools reserved for today", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");
  const today = dateFromToday(0);

  const reservedTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Reserved Today",
  });
  const futureReservationId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Future Reservation",
  });
  const pendingTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Pending Today",
  });
  const returnedTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Returned Today",
  });
  const declinedTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Declined Today",
  });
  const cancelledTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Cancelled Today",
  });
  await seedTool(t, ownerId, { ...validTool, name: "Always Available" });

  await seedBorrowRequest(t, {
    toolId: reservedTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "approved",
  });
  await seedBorrowRequest(t, {
    toolId: futureReservationId,
    ownerId,
    borrowerId,
    startDate: dateFromToday(7),
    endDate: dateFromToday(9),
    status: "approved",
  });
  await seedBorrowRequest(t, {
    toolId: pendingTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "pending",
  });
  await seedBorrowRequest(t, {
    toolId: returnedTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "returned",
  });
  await seedBorrowRequest(t, {
    toolId: declinedTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "declined",
  });
  await seedBorrowRequest(t, {
    toolId: cancelledTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "cancelled",
  });

  const names = (await t.query(api.tools.listPublicTools, publicQueryArgs())).map(
    (tool) => tool.name,
  );

  expect(names).not.toContain("Reserved Today");
  expect(names).toEqual(
    expect.arrayContaining([
      "Future Reservation",
      "Pending Today",
      "Returned Today",
      "Declined Today",
      "Cancelled Today",
      "Always Available",
    ]),
  );
});

test("approving and returning a loan toggles public visibility", async () => {
  const today = dateFromToday(0);
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_borrower");
  const toolId = await seedTool(t, ownerId);

  const borrower = t.withIdentity({ subject: "user_borrower" });
  const owner = t.withIdentity({ subject: "user_owner" });

  const requestId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, startDate: today, endDate: today },
  );

  // Pending requests never reserve dates.
  expect((await t.query(api.tools.listPublicTools, publicQueryArgs())).map((tool) => tool.name)).toEqual([
    "Cordless Drill",
  ]);

  await owner.mutation(api.borrowRequests.approveBorrowRequest, { requestId });
  expect(await t.query(api.tools.listPublicTools, publicQueryArgs())).toEqual([]);

  await owner.mutation(api.borrowRequests.markBorrowRequestReturned, {
    requestId,
  });
  expect((await t.query(api.tools.listPublicTools, publicQueryArgs())).map((tool) => tool.name)).toEqual([
    "Cordless Drill",
  ]);
});

test("the public preview fills six slots when available tools are within budget", async () => {
  const today = dateFromToday(0);
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");

  const availableNames = Array.from(
    { length: 6 },
    (_, index) => `Available ${index}`,
  );
  for (const name of availableNames) {
    await seedTool(t, ownerId, { ...validTool, name });
  }

  // Newer unavailable tools must be verified one by one, not treated as
  // available. Six available tools remain within the inspection budget.
  for (let index = 0; index < 25; index += 1) {
    const toolId = await seedTool(t, ownerId, {
      ...validTool,
      name: `Reserved ${index}`,
    });
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      startDate: today,
      endDate: today,
      status: "approved",
    });
  }

  const publicTools = await t.query(api.tools.listPublicTools, publicQueryArgs());

  expect(publicTools).toHaveLength(6);
  expect(new Set(publicTools.map((tool) => tool.name))).toEqual(
    new Set(availableNames),
  );
});

test("more than 200 approved reservations cannot leak into the preview", async () => {
  const today = dateFromToday(0);
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");

  const reserveTool = async (name: string) => {
    const toolId = await seedTool(t, ownerId, { ...validTool, name });
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      startDate: today,
      endDate: today,
      status: "approved",
    });
  };

  // The old implementation built its exclusion set from at most 200
  // reservations. These 205 reserved tools are deliberately older than the
  // available ones, so a truncated set would mark them available.
  for (let index = 0; index < 205; index += 1) {
    await reserveTool(`Old Reserved ${index}`);
  }

  await sleep(2);

  const availableNames = Array.from(
    { length: 6 },
    (_, index) => `Verified Available ${index}`,
  );
  for (const name of availableNames) {
    await seedTool(t, ownerId, { ...validTool, name });
  }

  await sleep(2);

  // Fill the rest of the candidate budget with newer unavailable tools. Six
  // available tools are still found within the 100-candidate budget.
  for (
    let index = 0;
    index < PUBLIC_AVAILABILITY_CANDIDATE_BUDGET - availableNames.length;
    index += 1
  ) {
    await reserveTool(`New Reserved ${index}`);
  }

  const publicTools = await t.query(
    api.tools.listPublicTools,
    publicQueryArgs(today),
  );
  const names = publicTools.map((tool) => tool.name);

  expect(names).toHaveLength(6);
  expect(new Set(names)).toEqual(new Set(availableNames));
  expect(names.every((name) => !name.includes("Reserved"))).toBe(true);
});

test("the candidate budget is exhausted without substituting unverified tools", async () => {
  const today = dateFromToday(0);
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");

  for (let index = 0; index < 6; index += 1) {
    await seedTool(t, ownerId, {
      ...validTool,
      name: `Available Beyond Budget ${index}`,
    });
  }

  await sleep(2);

  for (let index = 0; index < PUBLIC_AVAILABILITY_CANDIDATE_BUDGET; index += 1) {
    const toolId = await seedTool(t, ownerId, {
      ...validTool,
      name: `Reserved ${index}`,
    });
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      startDate: today,
      endDate: today,
      status: "approved",
    });
  }

  const publicTools = await t.query(
    api.tools.listPublicTools,
    publicQueryArgs(today),
  );

  // All 100 candidates are verified unavailable. The older available tools
  // are beyond the inspection budget, so the query must return none of them
  // rather than guessing.
  expect(publicTools).toEqual([]);
});

test("refreshDate cannot change the server's availability day", async () => {
  const today = dateFromToday(0);
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");

  const reservedTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Reserved Today",
  });
  const reservedTomorrowId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Reserved Tomorrow",
  });

  await seedBorrowRequest(t, {
    toolId: reservedTodayId,
    ownerId,
    borrowerId,
    startDate: today,
    endDate: today,
    status: "approved",
  });
  await seedBorrowRequest(t, {
    toolId: reservedTomorrowId,
    ownerId,
    borrowerId,
    startDate: dateFromToday(1),
    endDate: dateFromToday(2),
    status: "approved",
  });

  const refreshDates = [
    dateFromToday(-1),
    today,
    dateFromToday(1),
    "2000-01-01",
    "2099-12-31",
  ];

  for (const refreshDate of refreshDates) {
    const names = (
      await t.query(api.tools.listPublicTools, { refreshDate })
    ).map((tool) => tool.name);

    expect(names).toEqual(["Reserved Tomorrow"]);
  }

  await expect(
    t.query(api.tools.listPublicTools, { refreshDate: "2026-02-30" }),
  ).rejects.toThrow("refreshDate must be a valid date in YYYY-MM-DD format");
});

test("UTC midnight changes the server date used for availability", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");

  const startsTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Starts Today",
  });
  const endsTodayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Ends Today",
  });
  const startsTomorrowId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Starts Tomorrow",
  });
  const endedYesterdayId = await seedTool(t, ownerId, {
    ...validTool,
    name: "Ended Yesterday",
  });

  const seeded = [
    { toolId: startsTodayId, startDate: "2026-11-09", endDate: "2026-11-11" },
    { toolId: endsTodayId, startDate: "2026-11-07", endDate: "2026-11-09" },
    { toolId: startsTomorrowId, startDate: "2026-11-10", endDate: "2026-11-12" },
    { toolId: endedYesterdayId, startDate: "2026-11-07", endDate: "2026-11-08" },
  ];
  for (const dates of seeded) {
    await seedBorrowRequest(t, {
      toolId: dates.toolId,
      ownerId,
      borrowerId,
      startDate: dates.startDate,
      endDate: dates.endDate,
      status: "approved",
    });
  }

  try {
    setSystemTime(new Date("2026-11-09T23:59:00.000Z"));
    const beforeMidnight = await t.query(
      api.tools.listPublicTools,
      publicQueryArgs("2026-11-09"),
    );
    expect(new Set(beforeMidnight.map((tool) => tool.name))).toEqual(
      new Set(["Starts Tomorrow", "Ended Yesterday"]),
    );

    setSystemTime(new Date("2026-11-10T00:00:00.000Z"));
    const afterMidnight = await t.query(
      api.tools.listPublicTools,
      publicQueryArgs("2026-11-10"),
    );
    expect(new Set(afterMidnight.map((tool) => tool.name))).toEqual(
      new Set(["Ends Today", "Ended Yesterday"]),
    );

    // A stale or future refresh token only changes reactive identity; the
    // backend still uses the server's current UTC day.
    const staleToken = await t.query(
      api.tools.listPublicTools,
      publicQueryArgs("2026-11-09"),
    );
    const futureToken = await t.query(
      api.tools.listPublicTools,
      publicQueryArgs("2026-11-11"),
    );
    expect(staleToken).toEqual(afterMidnight);
    expect(futureToken).toEqual(afterMidnight);
  } finally {
    setSystemTime();
  }
});

test("getTool includes trusted owner recognition for authenticated members", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, ownerId);

  await t.run((ctx) =>
    ctx.db.patch(ownerId, { isTrustedLender: true }),
  );

  const tool = await t
    .withIdentity({ subject: "user_owner" })
    .query(api.tools.getTool, { toolId });

  expect(tool).toMatchObject({
    _id: toolId,
    owner: {
      _id: ownerId,
      displayName: "user_owner",
      isTrustedLender: true,
    },
  });

  const publicTools = await t.query(api.tools.listPublicTools, publicQueryArgs());
  expect(Object.keys(publicTools[0]).sort()).toEqual(["category", "name"]);
});

test("getActiveToolCount includes active listings only", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_other");
  const owner = t.withIdentity({ subject: "user_owner" });
  const other = t.withIdentity({ subject: "user_other" });

  const firstId = await owner.mutation(api.tools.createTool, validToolInput);
  await other.mutation(api.tools.createTool, {
    ...validToolInput,
    name: "Other Drill",
  });
  expect(await t.query(api.tools.getActiveToolCount)).toBe(2);

  await owner.mutation(api.tools.deleteTool, { toolId: firstId });
  expect(await t.query(api.tools.getActiveToolCount)).toBe(1);

  // Repeated archive is a no-op and must not decrement twice.
  await owner.mutation(api.tools.deleteTool, { toolId: firstId });
  expect(await t.query(api.tools.getActiveToolCount)).toBe(1);
  expect(await t.run((ctx) => ctx.db.get(firstId))).toMatchObject({
    ownerId,
    isArchived: true,
  });
});

test("countMyActiveTools requires authentication", async () => {
  const t = await createTest();

  await expect(t.query(api.tools.countMyActiveTools, {})).rejects.toThrow(
    "No authenticated user",
  );
});

test("countMyActiveTools counts only the caller's active listings", async () => {
  const t = await createTest();
  await seedUser(t, "user_owner");
  await seedUser(t, "user_other");
  const owner = t.withIdentity({ subject: "user_owner" });
  const other = t.withIdentity({ subject: "user_other" });

  const firstId = await owner.mutation(api.tools.createTool, validToolInput);
  await owner.mutation(api.tools.createTool, {
    ...validToolInput,
    name: "Owner Second Tool",
  });
  await other.mutation(api.tools.createTool, {
    ...validToolInput,
    name: "Other Tool",
  });

  expect(await owner.query(api.tools.countMyActiveTools, {})).toBe(2);
  expect(await other.query(api.tools.countMyActiveTools, {})).toBe(1);

  await owner.mutation(api.tools.deleteTool, { toolId: firstId });
  expect(await owner.query(api.tools.countMyActiveTools, {})).toBe(1);
  expect(await other.query(api.tools.countMyActiveTools, {})).toBe(1);
});

test("listMyTools requires authentication", async () => {
  const t = await createTest();

  await expect(
    t.query(api.tools.listMyTools, { paginationOpts: pageArgs }),
  ).rejects.toThrow("No authenticated user");
});

test("listMyTools returns only the caller's active listings", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const otherId = await seedUser(t, "user_other");

  await seedTool(t, ownerId, { ...validTool, name: "My Drill" });
  await seedTool(t, ownerId, {
    ...validTool,
    name: "My Archived Drill",
    isArchived: true,
  });
  await seedTool(t, otherId, {
    ...validTool,
    name: "Someone Else's Drill",
  });

  const mine = await t
    .withIdentity({ subject: "user_owner" })
    .query(api.tools.listMyTools, { paginationOpts: pageArgs });

  expect(mine.page.map((tool) => tool.name)).toEqual(["My Drill"]);
});

test("listMyTools paginates newest first", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const otherId = await seedUser(t, "user_other");

  for (let index = 0; index < 21; index += 1) {
    await sleep(2);
    await seedTool(t, ownerId, {
      ...validTool,
      name: `My Tool ${index}`,
    });
  }
  await seedTool(t, otherId, { ...validTool, name: "Other Tool" });

  const asUser = t.withIdentity({ subject: "user_owner" });
  const first = await asUser.query(api.tools.listMyTools, {
    paginationOpts: pageArgs,
  });

  expect(first.page).toHaveLength(20);
  expect(first.isDone).toBe(false);
  expect(first.page[0].name).toBe("My Tool 20");
  expect(first.page.map((tool) => tool.name)).not.toContain("Other Tool");

  const second = await asUser.query(api.tools.listMyTools, {
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(1);
  expect(second.isDone).toBe(true);
  expect(second.page[0].name).toBe("My Tool 0");
});

test("getTool requires authentication", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);

  await expect(
    t.query(api.tools.getTool, { toolId }),
  ).rejects.toThrow("No authenticated user");
});

test("getTool returns full listing details to authenticated users", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);

  const tool = await t
    .withIdentity({ subject: "user_owner" })
    .query(api.tools.getTool, { toolId });

  expect(tool).toMatchObject({
    _id: toolId,
    ownerId: userId,
    ...validTool,
  });
  expect(tool).toHaveProperty("description");
});

test("getTool returns null for malformed, missing, and archived IDs", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const archivedId = await seedTool(t, userId, { isArchived: true });
  const missingId = await seedTool(t, userId);

  await t.run((ctx) => ctx.db.delete(missingId));

  const asUser = t.withIdentity({ subject: "user_owner" });
  expect(
    await asUser.query(api.tools.getTool, { toolId: "not-a-tool-id" }),
  ).toBeNull();
  expect(await asUser.query(api.tools.getTool, { toolId: archivedId })).toBeNull();
  expect(await asUser.query(api.tools.getTool, { toolId: missingId })).toBeNull();
});

test("isToolOwner requires authentication and checks the source of truth", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_other");
  await seedUser(t, "user_admin", "admin");
  const toolId = await seedTool(t, ownerId);
  const archivedId = await seedTool(t, ownerId, { isArchived: true });

  await expect(
    t.query(api.tools.isToolOwner, { toolId }),
  ).rejects.toThrow("No authenticated user");

  const asOwner = t.withIdentity({ subject: "user_owner" });
  const asOther = t.withIdentity({ subject: "user_other" });
  const asAdmin = t.withIdentity({ subject: "user_admin" });

  expect(await asOwner.query(api.tools.isToolOwner, { toolId })).toBe(true);
  expect(await asOther.query(api.tools.isToolOwner, { toolId })).toBe(false);
  expect(await asAdmin.query(api.tools.isToolOwner, { toolId })).toBe(false);
  expect(
    await asOwner.query(api.tools.isToolOwner, { toolId: archivedId }),
  ).toBe(false);
  expect(
    await asOwner.query(api.tools.isToolOwner, { toolId: "not-a-tool-id" }),
  ).toBe(false);
  expect(
    await asOwner.query(api.tools.isToolOwner, { toolId: "j0000000000000000000000000000000" }),
  ).toBe(false);
});

test("updateTool requires authentication", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);

  await expect(
    t.mutation(api.tools.updateTool, { toolId, name: "New name" }),
  ).rejects.toThrow("No authenticated user");
});

test("updateTool lets the owner change fields without changing ownership", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);

  const result = await t
    .withIdentity({ subject: "user_owner" })
    .mutation(api.tools.updateTool, {
      toolId,
      name: "  Impact Driver  ",
      category: "Automotive",
      condition: "like_new",
    });

  expect(result).toBe(toolId);
  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    ownerId: userId,
    name: "Impact Driver",
    description: validTool.description,
    category: "Automotive",
    condition: "like_new",
    isArchived: false,
  });
});

test("updateTool rejects other users and admins", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_other");
  await seedUser(t, "user_admin", "admin");
  const toolId = await seedTool(t, ownerId);

  await expect(
    t
      .withIdentity({ subject: "user_other" })
      .mutation(api.tools.updateTool, { toolId, name: "Stolen" }),
  ).rejects.toThrow("You can only edit your own tool listings");

  await expect(
    t
      .withIdentity({ subject: "user_admin" })
      .mutation(api.tools.updateTool, { toolId, name: "Admin edit" }),
  ).rejects.toThrow("You can only edit your own tool listings");

  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    name: validTool.name,
  });
});

test("updateTool rejects archived listings and empty patches", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const archivedId = await seedTool(t, userId, { isArchived: true });
  const activeId = await seedTool(t, userId);
  const asUser = t.withIdentity({ subject: "user_owner" });

  await expect(
    asUser.mutation(api.tools.updateTool, { toolId: archivedId, name: "Nope" }),
  ).rejects.toThrow("Archived tool listings cannot be edited");

  await expect(
    asUser.mutation(api.tools.updateTool, { toolId: activeId }),
  ).rejects.toThrow("No fields to update");

  await expect(
    asUser.mutation(api.tools.updateTool, { toolId: activeId, name: "   " }),
  ).rejects.toThrow("Name is required");
});

test("updateTool only accepts predefined categories", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);
  const asUser = t.withIdentity({ subject: "user_owner" });

  await expect(
    asUser.mutation(api.tools.updateTool, {
      toolId,
      category: "Power tools",
    } as never),
  ).rejects.toThrow();

  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    category: "Power Tools",
  });
});

test("previously stored categories remain readable", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId, {
    category: "Garden",
    name: "Legacy Ladder",
  });
  const asUser = t.withIdentity({ subject: "user_owner" });

  const tool = await asUser.query(api.tools.getTool, { toolId });
  expect(tool).toMatchObject({ category: "Garden" });

  const allTools = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
  });
  expect(allTools.page.map((listing) => listing.name)).toContain(
    "Legacy Ladder",
  );

  const mine = await asUser.query(api.tools.listMyTools, {
    paginationOpts: pageArgs,
  });
  expect(mine.page.map((listing) => listing.name)).toContain("Legacy Ladder");

  const standardOnly = await asUser.query(api.tools.listTools, {
    paginationOpts: pageArgs,
    category: "Gardening",
  });
  expect(standardOnly.page.map((listing) => listing.name)).not.toContain(
    "Legacy Ladder",
  );
});

test("deleteTool requires authentication", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);

  await expect(t.mutation(api.tools.deleteTool, { toolId })).rejects.toThrow(
    "No authenticated user",
  );
  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    isArchived: false,
  });
});

test("deleteTool soft deletes the owner's listing", async () => {
  const t = await createTest();
  const userId = await seedUser(t, "user_owner");
  const toolId = await seedTool(t, userId);
  const asUser = t.withIdentity({ subject: "user_owner" });

  expect(await asUser.mutation(api.tools.deleteTool, { toolId })).toBe(toolId);

  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    ownerId: userId,
    isArchived: true,
  });
  expect(await asUser.query(api.tools.getTool, { toolId })).toBeNull();
  expect(
    await asUser.query(api.tools.listTools, { paginationOpts: pageArgs }),
  ).toMatchObject({ page: [], isDone: true });
});

test("deleteTool rejects users who do not own the listing", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_other");
  const toolId = await seedTool(t, ownerId);

  await expect(
    t
      .withIdentity({ subject: "user_other" })
      .mutation(api.tools.deleteTool, { toolId }),
  ).rejects.toThrow("You can only delete your own tool listings");

  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    isArchived: false,
  });
});

test("deleteTool lets admins remove anyone's listing", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  await seedUser(t, "user_admin", "admin");
  const toolId = await seedTool(t, ownerId);

  expect(
    await t
      .withIdentity({ subject: "user_admin" })
      .mutation(api.tools.deleteTool, { toolId }),
  ).toBe(toolId);

  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    ownerId,
    isArchived: true,
  });
});

test("admin archiving another owner's listing updates the aggregate exactly once", async () => {
  const t = await createTest();
  await seedUser(t, "user_owner");
  await seedUser(t, "user_admin", "admin");
  const owner = t.withIdentity({ subject: "user_owner" });
  const admin = t.withIdentity({ subject: "user_admin" });

  const toolId = await owner.mutation(api.tools.createTool, validToolInput);
  expect(await t.query(api.tools.getActiveToolCount)).toBe(1);

  await admin.mutation(api.tools.deleteTool, { toolId });
  expect(await t.query(api.tools.getActiveToolCount)).toBe(0);
  expect(
    await admin.query(api.admin.listAdminTools, { paginationOpts: pageArgs }),
  ).toMatchObject({ page: [], isDone: true });

  // Repeated archiving is a no-op and must not decrement the aggregate again.
  await admin.mutation(api.tools.deleteTool, { toolId });
  expect(await t.query(api.tools.getActiveToolCount)).toBe(0);
  expect(await t.run((ctx) => ctx.db.get(toolId))).toMatchObject({
    isArchived: true,
  });
});

test("aggregate backfill is idempotent and only counts active listings", async () => {
  const t = await createTest();
  const ownerId = await seedUser(t, "user_owner");
  const otherId = await seedUser(t, "user_other");

  await seedTool(t, ownerId, { ...validTool, name: "Owner Active 1" });
  await seedTool(t, ownerId, { ...validTool, name: "Owner Active 2" });
  await seedTool(t, ownerId, {
    ...validTool,
    name: "Owner Archived",
    isArchived: true,
  });
  await seedTool(t, otherId, { ...validTool, name: "Other Active" });

  expect(await t.query(api.tools.getActiveToolCount)).toBe(0);
  expect(
    await t
      .withIdentity({ subject: "user_owner" })
      .query(api.tools.countMyActiveTools, {}),
  ).toBe(0);

  const firstRun = await t.action(internal.migrations.backfillToolAggregate, {});
  expect(firstRun.processed).toBe(3);
  expect(await t.query(api.tools.getActiveToolCount)).toBe(3);
  expect(
    await t
      .withIdentity({ subject: "user_owner" })
      .query(api.tools.countMyActiveTools, {}),
  ).toBe(2);
  expect(
    await t
      .withIdentity({ subject: "user_other" })
      .query(api.tools.countMyActiveTools, {}),
  ).toBe(1);

  const secondRun = await t.action(internal.migrations.backfillToolAggregate, {});
  expect(secondRun.processed).toBe(3);
  expect(await t.query(api.tools.getActiveToolCount)).toBe(3);
  expect(
    await t
      .withIdentity({ subject: "user_owner" })
      .query(api.tools.countMyActiveTools, {}),
  ).toBe(2);
});
