"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  TOOL_CONDITION_LABELS,
  isToolCategory,
  isToolCondition,
  type ToolCategory,
  type ToolCondition,
} from "@/lib/toolOptions";
import { getErrorMessage } from "@/lib/errors";

export type ToolFormValues = {
  name: string;
  description: string;
  category: ToolCategory;
  condition: ToolCondition;
};

const labelClass =
  "block text-sm font-medium text-zinc-800 dark:text-zinc-200";
const fieldClass =
  "mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20";

export default function ToolForm({
  initialValues,
  submitLabel,
  onSubmit,
  cancelHref,
}: {
  initialValues?: {
    name?: string;
    description?: string;
    category?: string;
    condition?: string;
  };
  submitLabel: string;
  onSubmit: (values: ToolFormValues) => Promise<void>;
  cancelHref: string;
}) {
  const initialCategory = initialValues?.category;
  const legacyCategory =
    initialCategory && !isToolCategory(initialCategory)
      ? initialCategory
      : null;
  const initialCondition = initialValues?.condition;

  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [category, setCategory] = useState<ToolCategory | "">(
    initialCategory && isToolCategory(initialCategory) ? initialCategory : "",
  );
  const [condition, setCondition] = useState<ToolCondition | "">(
    initialCondition && isToolCondition(initialCondition)
      ? initialCondition
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function validateForm(): string | null {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) return "Name is required.";
    if (trimmedName.length > 100) {
      return "Name must be 100 characters or fewer.";
    }
    if (!trimmedDescription) return "Description is required.";
    if (trimmedDescription.length > 2_000) {
      return "Description must be 2,000 characters or fewer.";
    }
    if (!category) return "Choose a category.";
    if (!condition) return "Choose a condition.";

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!category || !condition) return;

    setError(null);
    setIsSaving(true);

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        category,
        condition,
      });
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="tool-name" className={labelClass}>
          Tool name
        </label>
        <input
          id="tool-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
          placeholder="e.g. Cordless drill"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="tool-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="tool-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2_000}
          required
          rows={5}
          placeholder="Include the model, what's included, and anything a borrower should know."
          className={`${fieldClass} resize-y`}
        />
        <p className="mt-2 text-xs text-zinc-500">
          {description.length}/2,000 characters
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="tool-category" className={labelClass}>
            Category
          </label>
          <select
            id="tool-category"
            value={category}
            onChange={(event) => {
              const value = event.target.value;
              setCategory(isToolCategory(value) ? value : "");
            }}
            required
            className={fieldClass}
          >
            <option value="" disabled>
              {legacyCategory
                ? `${legacyCategory} (legacy category)`
                : "Select a category"}
            </option>
            {TOOL_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {legacyCategory ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              This listing was saved with the old “{legacyCategory}” category.
              Choose a standard category to save your changes.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="tool-condition" className={labelClass}>
            Condition
          </label>
          <select
            id="tool-condition"
            value={condition}
            onChange={(event) => {
              const value = event.target.value;
              setCondition(isToolCondition(value) ? value : "");
            }}
            required
            className={fieldClass}
          >
            <option value="" disabled>
              Select a condition
            </option>
            {TOOL_CONDITIONS.map((option) => (
              <option key={option} value={option}>
                {TOOL_CONDITION_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          {isSaving ? "Saving…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
