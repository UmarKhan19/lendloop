"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import RequireAuth from "@/components/RequireAuth";
import ToolForm, { type ToolFormValues } from "@/components/ToolForm";

export default function NewToolPage() {
  return (
    <RequireAuth
      title="Sign in to list a tool"
      description="Create an account or sign in to share a tool with the LendLoop community."
    >
      <NewTool />
    </RequireAuth>
  );
}

function NewTool() {
  const createTool = useMutation(api.tools.createTool);
  const router = useRouter();

  async function handleCreate(values: ToolFormValues) {
    await createTool(values);
    router.push("/my-listings");
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          New listing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
          List a tool
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Add the details a neighbour would need to know. You can edit or remove
          the listing later.
        </p>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <ToolForm
            submitLabel="Publish listing"
            onSubmit={handleCreate}
            cancelHref="/tools"
          />
        </section>
      </div>
    </main>
  );
}
