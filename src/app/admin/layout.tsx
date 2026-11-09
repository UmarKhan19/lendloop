"use client";

import AdminGuard from "@/components/admin/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import RequireAuth from "@/components/RequireAuth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth
      title="Sign in to access admin"
      description="The admin console is only available to LendLoop administrators."
    >
      <AdminGuard>
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                  Administration
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                  Admin console
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Moderate listings, review borrowing activity, and manage
                  Trusted Lender recognition. Administrative actions are
                  read-only where the assignment does not require a change.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <AdminNav />
            </div>

            <div className="mt-8">{children}</div>
          </div>
        </main>
      </AdminGuard>
    </RequireAuth>
  );
}
