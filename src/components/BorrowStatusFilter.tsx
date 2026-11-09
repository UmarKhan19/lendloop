import {
  BORROW_STATUS_LABELS,
  BORROW_STATUS_ORDER,
  type BorrowStatus,
} from "@/lib/borrow";

export default function BorrowStatusFilter({
  value,
  onChange,
}: {
  value: BorrowStatus | "";
  onChange: (value: BorrowStatus | "") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        htmlFor="status-filter"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Filter by status
      </label>
      <select
        id="status-filter"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(
            BORROW_STATUS_ORDER.includes(next as BorrowStatus)
              ? (next as BorrowStatus)
              : "",
          );
        }}
        className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20"
      >
        <option value="">All statuses</option>
        {BORROW_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {BORROW_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          Clear filter
        </button>
      ) : null}
    </div>
  );
}
