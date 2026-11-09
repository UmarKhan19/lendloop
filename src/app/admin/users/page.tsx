"use client";

import { usePaginatedQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../../../convex/_generated/api";
import AdminLoadMore from "@/components/admin/AdminLoadMore";
import AdminTrustedLenderButton from "@/components/admin/AdminTrustedLenderButton";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listAdminUsers,
    searchTerm ? { search: searchTerm } : {},
    { initialNumItems: PAGE_SIZE },
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  return (
    <section>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Trusted Lender management
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Search members by display name and grant or revoke recognition. Trust
          status is independent of the user and admin roles.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
        role="search"
      >
        <label htmlFor="admin-user-search" className="sr-only">
          Search users by display name
        </label>
        <Input
          id="admin-user-search"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by display name"
          maxLength={100}
          className="h-10 bg-white sm:max-w-sm dark:bg-zinc-950"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" className="h-10 rounded-full px-4">
            Search
          </Button>
          {searchTerm || searchInput ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-full px-4"
              onClick={clearSearch}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Search runs against the Convex display-name index and keeps pagination
        server-side.
      </p>

      <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {status === "LoadingFirstPage" ? (
          <div className="p-6">
            <LoadingPanel label="Loading members…" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-6">
            <EmptyPanel
              title={
                searchTerm ? "No matching members" : "No members found"
              }
              description={
                searchTerm
                  ? `No display names match “${searchTerm}”. Try a different search.`
                  : "Member profiles appear here after they sign in."
              }
              action={
                searchTerm ? (
                  <Button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-full"
                  >
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Member</TableHead>
                <TableHead>Trusted Lender</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="pr-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((user) => (
                <TableRow key={user._id}>
                  <TableCell className="pl-4 font-medium text-zinc-950 dark:text-zinc-50">
                    {user.displayName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isTrustedLender ? "default" : "outline"}
                      className={
                        user.isTrustedLender
                          ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950"
                          : undefined
                      }
                    >
                      {user.isTrustedLender ? "Trusted" : "Standard"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.role}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <AdminTrustedLenderButton
                      userId={user._id}
                      displayName={user.displayName}
                      isTrustedLender={user.isTrustedLender}
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
            endLabel="You've reached the end of the member list."
          />
        </div>
      ) : null}
    </section>
  );
}
