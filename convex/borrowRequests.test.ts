import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { formatDateOnly, todayUtcDay } from "./borrowDates";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./borrowRequests.ts": () => import("./borrowRequests"),
};

type TestContext = ReturnType<typeof convexTest>;
type BorrowStatus = Doc<"borrowRequests">["status"];

const pageArgs = { numItems: 20, cursor: null };

function dateFromToday(offset: number) {
  return formatDateOnly(todayUtcDay() + offset);
}

function dateRange(startOffset: number, endOffset: number) {
  return {
    startDate: dateFromToday(startOffset),
    endDate: dateFromToday(endOffset),
  };
}

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

async function seedTool(
  t: TestContext,
  ownerId: Id<"users">,
  overrides: Partial<Pick<Doc<"tools">, "isArchived" | "name">> = {},
) {
  return await t.run((ctx) =>
    ctx.db.insert("tools", {
      ownerId,
      name: overrides.name ?? "Cordless Drill",
      description: "18V drill with two batteries",
      category: "Power Tools",
      condition: "good",
      isArchived: overrides.isArchived ?? false,
    }),
  );
}

type BorrowRequestFields = Pick<
  Doc<"borrowRequests">,
  "toolId" | "borrowerId" | "ownerId" | "startDate" | "endDate" | "status"
> &
  Partial<
    Pick<
      Doc<"borrowRequests">,
      "requestedAt" | "decidedAt" | "cancelledAt" | "returnedAt"
    >
  >;

async function seedBorrowRequest(
  t: TestContext,
  fields: BorrowRequestFields,
) {
  return await t.run((ctx) =>
    ctx.db.insert("borrowRequests", {
      requestedAt: Date.now(),
      ...fields,
    }),
  );
}

async function seedSetup(
  t: TestContext,
  options: { isArchived?: boolean } = {},
) {
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");
  const otherId = await seedUser(t, "user_other");
  const adminId = await seedUser(t, "user_admin", "admin");
  const toolId = await seedTool(t, ownerId, {
    isArchived: options.isArchived ?? false,
  });

  return { ownerId, borrowerId, otherId, adminId, toolId };
}

function as(t: TestContext, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

test("borrow request functions require authentication and write nothing", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");
  const toolId = await seedTool(t, ownerId);
  const dates = dateRange(1, 3);
  const requestId = await seedBorrowRequest(t, {
    toolId,
    borrowerId,
    ownerId,
    ...dates,
    status: "pending",
  });

  await expect(
    t.mutation(api.borrowRequests.createBorrowRequest, { toolId, ...dates }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.mutation(api.borrowRequests.approveBorrowRequest, { requestId }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.mutation(api.borrowRequests.declineBorrowRequest, { requestId }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.mutation(api.borrowRequests.cancelBorrowRequest, { requestId }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.mutation(api.borrowRequests.markBorrowRequestReturned, { requestId }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.query(api.borrowRequests.listOutgoingRequests, {
      paginationOpts: pageArgs,
    }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.query(api.borrowRequests.listIncomingRequests, {
      paginationOpts: pageArgs,
    }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.query(api.borrowRequests.getBorrowRequest, { requestId }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.query(api.borrowRequests.checkToolAvailability, { toolId, ...dates }),
  ).rejects.toThrow("No authenticated user");
  await expect(
    t.query(api.borrowRequests.listAllLoans, { paginationOpts: pageArgs }),
  ).rejects.toThrow("No authenticated user");

  expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
    status: "pending",
  });
  expect(await t.run((ctx) => ctx.db.query("borrowRequests").collect())).toHaveLength(1);
});

test("createBorrowRequest derives borrower and owner from trusted data", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const dates = dateRange(0, 2);

  const requestId = await as(t, "user_borrower").mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dates },
  );
  const request = await t.run((ctx) => ctx.db.get(requestId));

  expect(request).toMatchObject({
    toolId,
    borrowerId,
    ownerId,
    startDate: dates.startDate,
    endDate: dates.endDate,
    status: "pending",
  });
  expect(typeof request?.requestedAt).toBe("number");
});

test("createBorrowRequest rejects own, missing, and archived tools", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId } = await seedSetup(t);
  const dates = dateRange(1, 2);

  await expect(
    as(t, "user_owner").mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dates,
    }),
  ).rejects.toThrow("You cannot request your own tool");

  const missingToolId = await seedTool(t, ownerId);
  await t.run((ctx) => ctx.db.delete(missingToolId));
  await expect(
    as(t, "user_borrower").mutation(api.borrowRequests.createBorrowRequest, {
      toolId: missingToolId,
      ...dates,
    }),
  ).rejects.toThrow("Tool listing not found");

  const archivedToolId = await seedTool(t, ownerId, { isArchived: true });
  await expect(
    as(t, "user_borrower").mutation(api.borrowRequests.createBorrowRequest, {
      toolId: archivedToolId,
      ...dates,
    }),
  ).rejects.toThrow("Archived tool listings cannot be borrowed");

  expect(await t.run((ctx) => ctx.db.query("borrowRequests").collect())).toEqual(
    [],
  );
});

test("createBorrowRequest rejects invalid, past, reversed, and overlong ranges", async () => {
  const t = convexTest(schema, modules);
  const { toolId } = await seedSetup(t);
  const borrower = as(t, "user_borrower");

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      startDate: "2026-04-31",
      endDate: dateFromToday(2),
    }),
  ).rejects.toThrow("Start date must be a valid date in YYYY-MM-DD format");

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dateRange(-1, 2),
    }),
  ).rejects.toThrow("Start date cannot be in the past");

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dateRange(5, 4),
    }),
  ).rejects.toThrow("End date must be on or after the start date");

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dateRange(1, 91),
    }),
  ).rejects.toThrow("Borrowing period cannot exceed 90 days");

  const longestAllowedId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dateRange(1, 90) },
  );
  expect(await t.run((ctx) => ctx.db.get(longestAllowedId))).toMatchObject({
    status: "pending",
  });
});

test("duplicate pending requests are rejected only for the same tool and dates", async () => {
  const t = convexTest(schema, modules);
  const { toolId } = await seedSetup(t);
  const borrower = as(t, "user_borrower");
  const dates = dateRange(5, 8);

  const firstId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dates },
  );

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dates,
    }),
  ).rejects.toThrow("You already have a pending request for these dates");

  const differentDatesId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dateRange(10, 12) },
  );
  expect(differentDatesId).not.toBe(firstId);

  await borrower.mutation(api.borrowRequests.cancelBorrowRequest, {
    requestId: firstId,
  });

  const reRequestedId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dates },
  );
  expect(await t.run((ctx) => ctx.db.get(reRequestedId))).toMatchObject({
    status: "pending",
  });
});

test("pending requests do not reserve dates and overlapping requests can coexist", async () => {
  const t = convexTest(schema, modules);
  const { toolId } = await seedSetup(t);
  const dates = dateRange(10, 15);

  const firstId = await as(t, "user_borrower").mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dates },
  );
  const secondId = await as(t, "user_other").mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dates },
  );

  expect(
    await as(t, "user_other").query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dates,
    }),
  ).toBe(true);

  await as(t, "user_owner").mutation(api.borrowRequests.approveBorrowRequest, {
    requestId: firstId,
  });

  expect(
    await as(t, "user_other").query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dates,
    }),
  ).toBe(false);

  await expect(
    as(t, "user_owner").mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: secondId,
    }),
  ).rejects.toThrow("Tool is not available for the requested dates");

  expect(await t.run((ctx) => ctx.db.get(firstId))).toMatchObject({
    status: "approved",
  });
  expect(await t.run((ctx) => ctx.db.get(secondId))).toMatchObject({
    status: "pending",
  });
});

test("approved reservations reject overlapping requests on inclusive boundaries", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);

  await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(10, 20),
    status: "approved",
  });

  const borrower = as(t, "user_other");

  for (const range of [dateRange(20, 25), dateRange(5, 10), dateRange(12, 18)]) {
    await expect(
      borrower.mutation(api.borrowRequests.createBorrowRequest, {
        toolId,
        ...range,
      }),
    ).rejects.toThrow("Tool is not available for the requested dates");
  }

  const afterId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dateRange(21, 25) },
  );
  const beforeId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dateRange(1, 9) },
  );

  expect(await t.run((ctx) => ctx.db.get(afterId))).toMatchObject({
    status: "pending",
  });
  expect(await t.run((ctx) => ctx.db.get(beforeId))).toMatchObject({
    status: "pending",
  });
});

test("approval revalidates expired and overlong pending requests", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const owner = as(t, "user_owner");

  const expiredId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(-1, 2),
    status: "pending",
  });
  await expect(
    owner.mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: expiredId,
    }),
  ).rejects.toThrow("Start date cannot be in the past");

  const overlongId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 91),
    status: "pending",
  });
  await expect(
    owner.mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: overlongId,
    }),
  ).rejects.toThrow("Borrowing period cannot exceed 90 days");

  expect(await t.run((ctx) => ctx.db.get(expiredId))).toMatchObject({
    status: "pending",
  });
  expect(await t.run((ctx) => ctx.db.get(overlongId))).toMatchObject({
    status: "pending",
  });
});

test("archived tools reject new requests and pending approvals", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t, {
    isArchived: true,
  });

  await expect(
    as(t, "user_borrower").mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...dateRange(1, 3),
    }),
  ).rejects.toThrow("Archived tool listings cannot be borrowed");

  const pendingId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 3),
    status: "pending",
  });
  await expect(
    as(t, "user_owner").mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: pendingId,
    }),
  ).rejects.toThrow("Archived tool listings cannot be approved");

  expect(await t.run((ctx) => ctx.db.get(pendingId))).toMatchObject({
    status: "pending",
  });
});

test("approving and returning a loan records timestamps and keeps history after archiving", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const dates = dateRange(20, 25);

  const requestId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dates,
    status: "pending",
  });

  await as(t, "user_owner").mutation(api.borrowRequests.approveBorrowRequest, {
    requestId,
  });
  let request = await t.run((ctx) => ctx.db.get(requestId));
  expect(request).toMatchObject({ status: "approved" });
  expect(typeof request?.decidedAt).toBe("number");

  await t.run((ctx) => ctx.db.patch(toolId, { isArchived: true }));

  await as(t, "user_owner").mutation(
    api.borrowRequests.markBorrowRequestReturned,
    { requestId },
  );
  request = await t.run((ctx) => ctx.db.get(requestId));
  expect(request).toMatchObject({ status: "returned" });
  expect(typeof request?.returnedAt).toBe("number");

  expect(
    await as(t, "user_borrower").query(api.borrowRequests.getBorrowRequest, {
      requestId,
    }),
  ).toMatchObject({
    _id: requestId,
    status: "returned",
    toolId,
  });

  const outgoing = await as(t, "user_borrower").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: pageArgs },
  );
  expect(outgoing.page.map((item) => item._id)).toEqual([requestId]);
});

test("declining and cancelling pending requests record the right transition", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);

  const toDeclineId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 2),
    status: "pending",
  });
  await as(t, "user_owner").mutation(api.borrowRequests.declineBorrowRequest, {
    requestId: toDeclineId,
  });
  const declined = await t.run((ctx) => ctx.db.get(toDeclineId));
  expect(declined).toMatchObject({ status: "declined" });
  expect(typeof declined?.decidedAt).toBe("number");

  const toCancelId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(3, 4),
    status: "pending",
  });
  await as(t, "user_borrower").mutation(
    api.borrowRequests.cancelBorrowRequest,
    { requestId: toCancelId },
  );
  const cancelled = await t.run((ctx) => ctx.db.get(toCancelId));
  expect(cancelled).toMatchObject({ status: "cancelled" });
  expect(typeof cancelled?.cancelledAt).toBe("number");
});

test("invalid status transitions are rejected and terminal states stay terminal", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const owner = as(t, "user_owner");
  const borrower = as(t, "user_borrower");

  const pendingId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 2),
    status: "pending",
  });
  const approvedId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(3, 4),
    status: "approved",
  });
  const declinedId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(5, 6),
    status: "declined",
  });
  const cancelledId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(7, 8),
    status: "cancelled",
  });
  const returnedId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(9, 10),
    status: "returned",
  });

  for (const requestId of [approvedId, declinedId, cancelledId, returnedId]) {
    await expect(
      owner.mutation(api.borrowRequests.approveBorrowRequest, { requestId }),
    ).rejects.toThrow("Only pending requests can be approved");
  }

  for (const requestId of [approvedId, cancelledId, returnedId]) {
    await expect(
      owner.mutation(api.borrowRequests.declineBorrowRequest, { requestId }),
    ).rejects.toThrow("Only pending requests can be declined");
  }

  for (const requestId of [approvedId, declinedId, returnedId]) {
    await expect(
      borrower.mutation(api.borrowRequests.cancelBorrowRequest, { requestId }),
    ).rejects.toThrow("Only pending requests can be cancelled");
  }

  for (const requestId of [pendingId, declinedId, cancelledId, returnedId]) {
    await expect(
      owner.mutation(api.borrowRequests.markBorrowRequestReturned, {
        requestId,
      }),
    ).rejects.toThrow("Only approved loans can be marked returned");
  }

  await owner.mutation(api.borrowRequests.markBorrowRequestReturned, {
    requestId: approvedId,
  });
  await expect(
    owner.mutation(api.borrowRequests.markBorrowRequestReturned, {
      requestId: approvedId,
    }),
  ).rejects.toThrow("Only approved loans can be marked returned");
});

test("only the correct participant can change a request", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const requestId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 3),
    status: "pending",
  });

  await expect(
    as(t, "user_other").mutation(api.borrowRequests.approveBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the tool owner can approve this request");
  await expect(
    as(t, "user_borrower").mutation(api.borrowRequests.approveBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the tool owner can approve this request");
  await expect(
    as(t, "user_admin").mutation(api.borrowRequests.approveBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the tool owner can approve this request");

  await expect(
    as(t, "user_other").mutation(api.borrowRequests.declineBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the tool owner can decline this request");
  await expect(
    as(t, "user_borrower").mutation(api.borrowRequests.declineBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the tool owner can decline this request");

  await expect(
    as(t, "user_owner").mutation(api.borrowRequests.cancelBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the borrower can cancel this request");
  await expect(
    as(t, "user_other").mutation(api.borrowRequests.cancelBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("Only the borrower can cancel this request");

  await expect(
    as(t, "user_other").mutation(
      api.borrowRequests.markBorrowRequestReturned,
      { requestId },
    ),
  ).rejects.toThrow("Only the tool owner can mark this loan returned");
  await expect(
    as(t, "user_admin").mutation(
      api.borrowRequests.markBorrowRequestReturned,
      { requestId },
    ),
  ).rejects.toThrow("Only the tool owner can mark this loan returned");

  expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
    status: "pending",
  });
});

test("getBorrowRequest is limited to participants and admins", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const requestId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(1, 3),
    status: "pending",
  });

  expect(
    await as(t, "user_borrower").query(api.borrowRequests.getBorrowRequest, {
      requestId,
    }),
  ).toMatchObject({ _id: requestId });
  expect(
    await as(t, "user_owner").query(api.borrowRequests.getBorrowRequest, {
      requestId,
    }),
  ).toMatchObject({ _id: requestId });
  expect(
    await as(t, "user_admin").query(api.borrowRequests.getBorrowRequest, {
      requestId,
    }),
  ).toMatchObject({ _id: requestId });

  await expect(
    as(t, "user_other").query(api.borrowRequests.getBorrowRequest, {
      requestId,
    }),
  ).rejects.toThrow("You do not have access to this borrow request");

  const missingId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(4, 5),
    status: "pending",
  });
  await t.run((ctx) => ctx.db.delete(missingId));

  const borrower = as(t, "user_borrower");
  expect(
    await borrower.query(api.borrowRequests.getBorrowRequest, {
      requestId: "not-a-request-id",
    }),
  ).toBeNull();
  expect(
    await borrower.query(api.borrowRequests.getBorrowRequest, {
      requestId: missingId,
    }),
  ).toBeNull();
});

test("outgoing and incoming lists are scoped to the caller and filterable by status", async () => {
  const t = convexTest(schema, modules);
  const ownerOneId = await seedUser(t, "owner_one");
  const ownerTwoId = await seedUser(t, "owner_two");
  const borrowerOneId = await seedUser(t, "borrower_one");
  const borrowerTwoId = await seedUser(t, "borrower_two");
  const toolOneId = await seedTool(t, ownerOneId);
  const toolTwoId = await seedTool(t, ownerTwoId);

  const requestOneId = await seedBorrowRequest(t, {
    toolId: toolOneId,
    ownerId: ownerOneId,
    borrowerId: borrowerOneId,
    ...dateRange(1, 2),
    status: "approved",
  });
  const requestTwoId = await seedBorrowRequest(t, {
    toolId: toolTwoId,
    ownerId: ownerTwoId,
    borrowerId: borrowerOneId,
    ...dateRange(3, 4),
    status: "pending",
  });
  const requestThreeId = await seedBorrowRequest(t, {
    toolId: toolOneId,
    ownerId: ownerOneId,
    borrowerId: borrowerTwoId,
    ...dateRange(5, 6),
    status: "declined",
  });
  await seedBorrowRequest(t, {
    toolId: toolTwoId,
    ownerId: ownerTwoId,
    borrowerId: borrowerTwoId,
    ...dateRange(7, 8),
    status: "returned",
  });

  const outgoing = await as(t, "borrower_one").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: pageArgs },
  );
  expect(new Set(outgoing.page.map((request) => request._id))).toEqual(
    new Set([requestOneId, requestTwoId]),
  );

  const pendingOutgoing = await as(t, "borrower_one").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: pageArgs, status: "pending" },
  );
  expect(pendingOutgoing.page.map((request) => request._id)).toEqual([
    requestTwoId,
  ]);

  const incoming = await as(t, "owner_one").query(
    api.borrowRequests.listIncomingRequests,
    { paginationOpts: pageArgs },
  );
  expect(new Set(incoming.page.map((request) => request._id))).toEqual(
    new Set([requestOneId, requestThreeId]),
  );
  expect(incoming.page.every((request) => request.ownerId === ownerOneId)).toBe(
    true,
  );

  const approvedIncoming = await as(t, "owner_one").query(
    api.borrowRequests.listIncomingRequests,
    { paginationOpts: pageArgs, status: "approved" },
  );
  expect(approvedIncoming.page.map((request) => request._id)).toEqual([
    requestOneId,
  ]);
});

test("outgoing and incoming lists paginate without a fixed result cap", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");
  const toolId = await seedTool(t, ownerId);

  for (let index = 0; index < 21; index += 1) {
    await sleep(2);
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      ...dateRange(1, 2),
      status: "pending",
    });
  }

  const outgoingFirst = await as(t, "user_borrower").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: pageArgs },
  );
  expect(outgoingFirst.page).toHaveLength(20);
  expect(outgoingFirst.isDone).toBe(false);

  const outgoingSecond = await as(t, "user_borrower").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: { numItems: 20, cursor: outgoingFirst.continueCursor } },
  );
  expect(outgoingSecond.page).toHaveLength(1);
  expect(outgoingSecond.isDone).toBe(true);

  const incomingFirst = await as(t, "user_owner").query(
    api.borrowRequests.listIncomingRequests,
    { paginationOpts: pageArgs },
  );
  expect(incomingFirst.page).toHaveLength(20);
  expect(incomingFirst.isDone).toBe(false);

  const incomingSecond = await as(t, "user_owner").query(
    api.borrowRequests.listIncomingRequests,
    { paginationOpts: { numItems: 20, cursor: incomingFirst.continueCursor } },
  );
  expect(incomingSecond.page).toHaveLength(1);
  expect(incomingSecond.isDone).toBe(true);
});

test("checkToolAvailability ignores pending and returned requests but respects approved ones", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const user = as(t, "user_other");

  const approvedId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(10, 20),
    status: "approved",
  });
  await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(30, 35),
    status: "pending",
  });
  await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(40, 45),
    status: "returned",
  });

  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(15, 18),
    }),
  ).toBe(false);
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(30, 35),
    }),
  ).toBe(true);
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(40, 45),
    }),
  ).toBe(true);
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(21, 25),
    }),
  ).toBe(true);

  await t.run((ctx) => ctx.db.patch(approvedId, { status: "returned" }));
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(15, 18),
    }),
  ).toBe(true);

  await t.run((ctx) => ctx.db.patch(toolId, { isArchived: true }));
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(50, 51),
    }),
  ).toBe(false);

  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId: "not-a-tool-id",
      ...dateRange(50, 51),
    }),
  ).toBe(false);

  const missingToolId = await seedTool(t, ownerId);
  await t.run((ctx) => ctx.db.delete(missingToolId));
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId: missingToolId,
      ...dateRange(50, 51),
    }),
  ).toBe(false);

  await expect(
    user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(-1, 1),
    }),
  ).rejects.toThrow("Start date cannot be in the past");
});

test("listAllLoans is paginated and restricted to admins", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await seedUser(t, "user_owner");
  const borrowerId = await seedUser(t, "user_borrower");
  await seedUser(t, "user_admin", "admin");
  const toolId = await seedTool(t, ownerId);
  const statuses: BorrowStatus[] = [
    "pending",
    "approved",
    "declined",
    "cancelled",
    "returned",
  ];

  for (let index = 0; index < 22; index += 1) {
    await sleep(2);
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      ...dateRange(1 + index, 2 + index),
      status: statuses[index % statuses.length],
    });
  }

  await expect(
    as(t, "user_borrower").query(api.borrowRequests.listAllLoans, {
      paginationOpts: pageArgs,
    }),
  ).rejects.toThrow("Admin access required");

  const first = await as(t, "user_admin").query(
    api.borrowRequests.listAllLoans,
    { paginationOpts: pageArgs },
  );
  expect(first.page).toHaveLength(20);
  expect(first.isDone).toBe(false);

  const second = await as(t, "user_admin").query(api.borrowRequests.listAllLoans, {
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(2);
  expect(second.isDone).toBe(true);

  const approved = await as(t, "user_admin").query(
    api.borrowRequests.listAllLoans,
    { paginationOpts: pageArgs, status: "approved" },
  );
  expect(approved.isDone).toBe(true);
  expect(approved.page).toHaveLength(5);
  expect(approved.page.every((request) => request.status === "approved")).toBe(
    true,
  );
});

test("overlap detection finds conflicts among many historical approvals", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);

  // These past reservations must not be scanned or treated as conflicts for a
  // future range.
  for (let index = 0; index < 120; index += 1) {
    const start = -5_000 - index * 2;
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      ...dateRange(start, start + 1),
      status: "approved",
    });
  }

  // A future reservation that ends after the requested start but begins after
  // the requested end must be excluded by the startDate filter.
  await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(200, 210),
    status: "approved",
  });

  await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(100, 105),
    status: "approved",
  });

  const user = as(t, "user_other");

  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(102, 104),
    }),
  ).toBe(false);
  expect(
    await user.query(api.borrowRequests.checkToolAvailability, {
      toolId,
      ...dateRange(110, 120),
    }),
  ).toBe(true);

  const requestId = await user.mutation(
    api.borrowRequests.createBorrowRequest,
    { toolId, ...dateRange(110, 120) },
  );
  expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({
    status: "pending",
  });
});

test("duplicate pending detection is an exact indexed lookup among many requests", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);

  for (let index = 0; index < 80; index += 1) {
    const start = 100 + index * 2;
    await seedBorrowRequest(t, {
      toolId,
      ownerId,
      borrowerId,
      ...dateRange(start, start + 1),
      status: "pending",
    });
  }

  const borrower = as(t, "user_borrower");
  const duplicateDates = dateRange(100 + 40 * 2, 100 + 40 * 2 + 1);

  await expect(
    borrower.mutation(api.borrowRequests.createBorrowRequest, {
      toolId,
      ...duplicateDates,
    }),
  ).rejects.toThrow("You already have a pending request for these dates");

  const differentId = await borrower.mutation(
    api.borrowRequests.createBorrowRequest,
    {
      toolId,
      startDate: duplicateDates.startDate,
      endDate: dateFromToday(100 + 40 * 2 + 2),
    },
  );
  expect(await t.run((ctx) => ctx.db.get(differentId))).toMatchObject({
    status: "pending",
  });
});

test("request queries expose tool and participant details including archived history", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId, borrowerId } = await seedSetup(t);
  const requestId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId,
    ...dateRange(20, 22),
    status: "approved",
  });

  await t.run((ctx) => ctx.db.patch(toolId, { isArchived: true }));

  const detail = await as(t, "user_borrower").query(
    api.borrowRequests.getBorrowRequest,
    { requestId },
  );
  expect(detail).toMatchObject({
    _id: requestId,
    tool: {
      _id: toolId,
      name: "Cordless Drill",
      category: "Power Tools",
      isArchived: true,
    },
    borrower: { _id: borrowerId, displayName: "user_borrower" },
    owner: { _id: ownerId, displayName: "user_owner" },
  });

  const outgoing = await as(t, "user_borrower").query(
    api.borrowRequests.listOutgoingRequests,
    { paginationOpts: pageArgs },
  );
  expect(outgoing.page[0]).toMatchObject({
    _id: requestId,
    tool: { name: "Cordless Drill", isArchived: true },
    borrower: { displayName: "user_borrower" },
    owner: { displayName: "user_owner" },
  });

  const incoming = await as(t, "user_owner").query(
    api.borrowRequests.listIncomingRequests,
    { paginationOpts: pageArgs },
  );
  expect(incoming.page[0]).toMatchObject({
    _id: requestId,
    tool: { name: "Cordless Drill", isArchived: true },
    borrower: { displayName: "user_borrower" },
  });
});

test("two simultaneous overlapping approvals allow at most one to succeed", async () => {
  const t = convexTest(schema, modules);
  const { toolId, ownerId } = await seedSetup(t);
  const dates = dateRange(10, 15);

  const firstId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId: await seedUser(t, "user_borrower_one"),
    ...dates,
    status: "pending",
  });
  const secondId = await seedBorrowRequest(t, {
    toolId,
    ownerId,
    borrowerId: await seedUser(t, "user_borrower_two"),
    ...dates,
    status: "pending",
  });

  const owner = as(t, "user_owner");
  const results = await Promise.allSettled([
    owner.mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: firstId,
    }),
    owner.mutation(api.borrowRequests.approveBorrowRequest, {
      requestId: secondId,
    }),
  ]);

  // convex-test serializes top-level transactions in memory, so this proves
  // the invariant holds for interleaved approvals rather than reproducing
  // production OCC retries. Convex's serializable execution provides the
  // production guarantee because the approval read and write share one
  // mutation.
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  if (rejected[0].status === "rejected") {
    expect(String(rejected[0].reason)).toContain(
      "Tool is not available for the requested dates",
    );
  }

  const requests = await t.run((ctx) =>
    Promise.all([ctx.db.get(firstId), ctx.db.get(secondId)]),
  );
  expect(requests.filter((request) => request?.status === "approved")).toHaveLength(
    1,
  );
  expect(requests.filter((request) => request?.status === "pending")).toHaveLength(
    1,
  );
});
