"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";

const sections = [
  {
    href: "/admin/listings",
    title: "Listing moderation",
    description:
      "Review every active listing, identify its owner, and archive listings that should leave the catalogue.",
    action: "Manage listings",
  },
  {
    href: "/admin/loans",
    title: "Borrowing activity",
    description:
      "Inspect all borrowing requests and loans, filter by status, and open request details. This view is read-only.",
    action: "Review loans",
  },
  {
    href: "/admin/users",
    title: "Trusted Lenders",
    description:
      "Search members and grant or revoke Trusted Lender recognition. Roles and trust status stay independent.",
    action: "Manage users",
  },
] as const;

export default function AdminOverviewPage() {
  const activeCount = useQuery(api.tools.getActiveToolCount);

  return (
    <div>
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Active listings
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This count matches the marketplace aggregate: every non-archived
              listing, whether or not it is reserved for today.
            </p>
          </div>
          <p className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {activeCount === undefined ? "…" : activeCount}
          </p>
        </div>
        <Badge variant="secondary" className="mt-5">
          Updated reactively by Convex
        </Badge>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <section
            key={section.href}
            className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {section.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {section.description}
            </p>
            <Link
              href={section.href}
              className="mt-5 text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {section.action} →
            </Link>
          </section>
        ))}
      </div>

      <p className="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Admins can archive any listing and manage Trusted Lender recognition.
        Approvals, cancellations, and returns remain with the borrower and tool
        owner.
      </p>
    </div>
  );
}
