import Link from "next/link";
import type { ReactNode } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { toolConditionLabel } from "@/lib/toolOptions";

export default function ToolCard({
  tool,
  actions,
}: {
  tool: Doc<"tools">;
  actions?: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {tool.name}
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {tool.category}
        </span>
      </div>

      <p className="mt-3 flex-1 whitespace-pre-line text-sm leading-6 text-zinc-600 line-clamp-4 dark:text-zinc-400">
        {tool.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {toolConditionLabel(tool.condition)}
        </span>
        {actions ?? (
          <Link
            href={`/tools/${tool._id}`}
            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            View details
          </Link>
        )}
      </div>
    </article>
  );
}
