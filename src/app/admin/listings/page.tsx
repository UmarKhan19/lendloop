"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import AdminArchiveToolButton from "@/components/admin/AdminArchiveToolButton";
import AdminLoadMore from "@/components/admin/AdminLoadMore";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import TrustedLenderBadge from "@/components/TrustedLenderBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toolConditionLabel } from "@/lib/toolOptions";

const PAGE_SIZE = 20;

export default function AdminListingsPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listAdminTools,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Listing moderation
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Active listings across every member. Archiving removes a listing
            from browsing and moderation while keeping its borrowing history.
          </p>
        </div>
        <Badge variant="outline">Active only</Badge>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {status === "LoadingFirstPage" ? (
          <div className="p-6">
            <LoadingPanel label="Loading listings…" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-6">
            <EmptyPanel
              title="No active listings"
              description="There are no active listings to moderate right now."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Tool</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((tool) => (
                <TableRow key={tool._id}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      href={`/tools/${tool._id}`}
                      className="text-zinc-950 transition hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-400"
                    >
                      {tool.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tool.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{tool.owner?.displayName ?? "Unknown member"}</span>
                      {tool.owner?.isTrustedLender ? (
                        <TrustedLenderBadge />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{toolConditionLabel(tool.condition)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Active</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <AdminArchiveToolButton
                      toolId={tool._id}
                      toolName={tool.name}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {status !== "LoadingFirstPage" && results.length > 0 ? (
        <div className="mt-6">
          <AdminLoadMore
            canLoadMore={status === "CanLoadMore"}
            isLoading={status === "LoadingMore"}
            isDone={status === "Exhausted"}
            onLoadMore={() => loadMore(PAGE_SIZE)}
            endLabel="You've reached the end of the active listings."
          />
        </div>
      ) : null}
    </section>
  );
}
