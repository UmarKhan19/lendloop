# LendLoop

A neighbourhood tool-sharing marketplace built for a full-stack take-home
assignment. Members list tools, browse what is available, and request date
ranges; owners approve, decline, and mark loans returned.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS v4
- Clerk authentication
- Convex database, queries, mutations, and the Aggregate component
- shadcn/ui for the admin console
- Bun for scripts and tests

## Local setup

```bash
bun install
bunx convex dev
bun run dev
```

`bunx convex dev` writes `NEXT_PUBLIC_CONVEX_URL` and
`NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local`. Clerk needs these values:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

The Convex deployment also needs `CLERK_FRONTEND_API_URL` (the Clerk Frontend
API URL, not the publishable key) so `convex/auth.config.ts` can validate
tokens:

```bash
bunx convex env set CLERK_FRONTEND_API_URL https://your-instance.clerk.accounts.dev
```

Adding the `users.search_displayName` index is applied automatically by
`convex dev` or `convex deploy`.

## Admin bootstrap

Regular users cannot promote themselves. The first admin is created once from
the Convex CLI, after that person has signed in and a `users` row exists:

```bash
# Find the target user's Clerk ID in the dev deployment.
bunx convex data users

# Internal mutation: dev only. Add --prod only when you deliberately want
# to promote someone in production.
bunx convex run admin:promoteToAdmin '{"clerkId":"user_..."}'
```

Roles and Trusted Lender status are independent. Admins can grant or revoke
trust from `/admin/users`; they cannot edit other members' listings, and only
tool owners can approve, decline, or return loans.

## Public availability

The public homepage previews at most six tools that are not archived and have
no approved borrowing request covering the current UTC calendar day. Pending,
declined, cancelled, and returned requests do not reserve dates. Both ends of
an approved reservation are inclusive, so a loan from the 9th to the 11th
covers the 9th, 10th, and 11th.

The query reads the newest active tools with the `by_isArchived` index. For
each candidate it performs one complete indexed reservation lookup using
`by_toolId_and_status_and_endDate`: approved, `endDate >= today`, and
`startDate <= today`. That lookup has no result cap, so it cannot miss a
conflict and report a false available tool. Checking stops as soon as six
verified tools are found.

The candidate-inspection budget is 100 tools. A single query therefore costs
at most 101 index reads (the tools read plus one lookup per candidate), well
below Convex's 4,096 index-range and 32,000 scanned-document limits. If the
newest 100 active tools are all reserved, the preview intentionally returns
fewer than six tools, possibly none. It never fills slots with unverified
listings. This is a bounded homepage preview, not an unlimited scan of the
catalogue.

The client passes a `refreshDate` argument that changes when the UTC date
changes. The backend validates its `YYYY-MM-DD` format but does not trust it:
every availability decision uses the current UTC date derived from the
server's clock. A manipulated past or future date can only cause a harmless
re-query; it cannot change which day is considered today. The `useUtcDate`
hook schedules one timer for the next UTC midnight, and also rechecks on
document visibility and window focus so suspended background tabs recover.
There is no Convex cron job or maintained database clock.

The homepage counter remains the aggregate of all active (non-archived)
listings, labelled "Active listings". That is deliberately different from
"available today", which also depends on approved reservations.

## Checks

```bash
bun test
bun run lint
bun run typecheck
bun run build
```

Backend tests cover public availability, approval and return transitions,
admin listing and loan access, listing removal, Trusted Lender grant and
revoke idempotency, non-admin rejection, user search pagination, and aggregate
correctness after admin moderation.

## Admin routes

- `/admin` — overview and links to the management areas
- `/admin/listings` — active listing moderation with archive confirmation
- `/admin/loans` — read-only borrowing activity with status filtering
- `/admin/users` — searchable Trusted Lender management

Non-admin users see an access-denied state, and every admin query or mutation
checks the role stored in Convex.
