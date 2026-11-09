"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const viewer = useQuery(api.users.getViewer);

  if (viewer === undefined) {
    return <LoadingPanel label="Checking admin access…" />;
  }

  if (viewer === null || viewer.role !== "admin") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg">
          <EmptyPanel
            title="Admin access required"
            description="This area is only available to LendLoop administrators. If you believe you should have access, contact the project maintainer."
            action={
              <Link
                href="/tools"
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Back to tools
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
