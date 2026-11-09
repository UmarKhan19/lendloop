"use client";

import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import AdminLoadMore from "@/components/admin/AdminLoadMore";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import TrustedLenderBadge from "@/components/TrustedLenderBadge";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BORROW_STATUS_LABELS,
  BORROW_STATUS_ORDER,
  BORROW_STATUS_STYLES,
  formatBorrowDate,
  formatBorrowTimestamp,
  type BorrowStatus,
} from "@/lib/borrow";

const PAGE_SIZE = 20;

function transitionTimestamp(request: {
  status: BorrowStatus;
  decidedAt?: number;
  cancelledAt?: number;
  returnedAt?: number;
}) {
  if (request.status === "returned" && request.returnedAt !== undefined) {
    return { label: "Returned", value: request.returnedAt };
  }
  if (request.status === "cancelled" && request.cancelledAt !== undefined) {
    return { label: "Cancelled", value: request.cancelledAt };
  }
  if (request.decidedAt !== undefined) {
    return { label: "Decided", value: request.decidedAt };
  }
  return null;
}

export default function AdminLoansPage() {
  const [status, setStatus] = useState<BorrowStatus | "">("");
  const {
    results,
    status: queryStatus,
    loadMore,
  } = usePaginatedQuery(
    api.borrowRequests.listAllLoans,
    status === "" ? {} : { status },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Borrowing activity
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Every borrowing request and loan across LendLoop. This view is
            read-only; approvals, cancellations, and returns remain with the
            borrower and tool owner.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="admin-loan-status"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Status
          </label>
          <Select
            value={status === "" ? "all" : status}
            onValueChange={(value) =>
              setStatus(value === "all" ? "" : (value as BorrowStatus))
            }
          >
            <SelectTrigger
              id="admin-loan-status"
              className="w-[170px] bg-white dark:bg-zinc-950"
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {BORROW_STATUS_ORDER.map((option) => (
                <SelectItem key={option} value={option}>
                  {BORROW_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {queryStatus === "LoadingFirstPage" ? (
          <div className="p-6">
            <LoadingPanel label="Loading borrowing activity…" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-6">
            <EmptyPanel
              title={
                status
                  ? `No ${BORROW_STATUS_LABELS[status].toLowerCase()} requests`
                  : "No borrowing activity yet"
              }
              description={
                status
                  ? "There are no requests with this status. Try another filter."
                  : "When members request or lend tools, the activity will appear here."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Tool</TableHead>
                <TableHead>Borrower</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="pr-4 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((request) => {
                const transition = transitionTimestamp(request);
                return (
                  <TableRow key={request._id}>
                    <TableCell className="pl-4 font-medium">
                      <Link
                        href={`/requests/${request._id}`}
                        className="text-zinc-950 transition hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-400"
                      >
                        {request.tool?.name ?? "Tool unavailable"}
                      </Link>
                      {request.tool?.isArchived ? (
                        <Badge variant="outline" className="ml-2">
                          Archived
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {request.borrower?.displayName ?? "Unknown member"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{request.owner?.displayName ?? "Unknown member"}</span>
                        {request.owner?.isTrustedLender ? (
                          <TrustedLenderBadge />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatBorrowDate(request.startDate)} –{" "}
                      {formatBorrowDate(request.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={BORROW_STATUS_STYLES[request.status]}
                      >
                        {BORROW_STATUS_LABELS[request.status]}
                      </Badge>
                      {transition ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transition.label}{" "}
                          {formatBorrowTimestamp(transition.value)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatBorrowTimestamp(request.requestedAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Link
                        href={`/requests/${request._id}`}
                        className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {queryStatus !== "LoadingFirstPage" && results.length > 0 ? (
        <div className="mt-6">
          <AdminLoadMore
            canLoadMore={queryStatus === "CanLoadMore"}
            isLoading={queryStatus === "LoadingMore"}
            isDone={queryStatus === "Exhausted"}
            onLoadMore={() => loadMore(PAGE_SIZE)}
            endLabel="You've reached the end of the borrowing activity."
          />
        </div>
      ) : null}
    </section>
  );
}
