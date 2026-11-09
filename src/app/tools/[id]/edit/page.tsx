"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { EmptyPanel, LoadingPanel } from "@/components/PageStates";
import RequireAuth from "@/components/RequireAuth";
import ToolForm, { type ToolFormValues } from "@/components/ToolForm";

export default function EditToolPage() {
  return (
    <RequireAuth
      title="Sign in to edit this listing"
      description="Only the owner of a listing can update its details."
    >
      <EditTool />
    </RequireAuth>
  );
}

function EditTool() {
  const params = useParams<{ id: string }>();
  const toolId = params.id;
  const router = useRouter();
  const tool = useQuery(api.tools.getTool, { toolId });
  const isOwner = useQuery(api.tools.isToolOwner, { toolId });
  const updateTool = useMutation(api.tools.updateTool);

  async function handleUpdate(values: ToolFormValues) {
    if (!tool) return;

    await updateTool({ toolId: tool._id, ...values });
    router.push("/my-listings");
  }

  if (tool === undefined || isOwner === undefined) {
    return <LoadingPanel label="Loading listing…" />;
  }

  if (tool === null) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg">
          <EmptyPanel
            title="Listing not available"
            description="This tool may have been archived or removed, or the link may be incorrect."
            action={
              <Link
                href="/my-listings"
                className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Go to My listings
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-lg">
          <EmptyPanel
            title="You can only edit your own listings"
            description="This listing belongs to another LendLoop member. You can still browse its details."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/tools/${tool._id}`}
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  View listing
                </Link>
                <Link
                  href="/my-listings"
                  className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  My listings
                </Link>
              </div>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Edit listing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
          {tool.name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Update the details below. Changes are visible to other members
          immediately.
        </p>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <ToolForm
            initialValues={{
              name: tool.name,
              description: tool.description,
              category: tool.category,
              condition: tool.condition,
            }}
            submitLabel="Save changes"
            onSubmit={handleUpdate}
            cancelHref="/my-listings"
          />
        </section>
      </div>
    </main>
  );
}
