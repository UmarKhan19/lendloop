import {
  BORROW_STATUS_LABELS,
  BORROW_STATUS_STYLES,
  type BorrowStatus,
} from "@/lib/borrow";

export default function RequestStatusBadge({
  status,
}: {
  status: BorrowStatus;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${BORROW_STATUS_STYLES[status]}`}
    >
      {BORROW_STATUS_LABELS[status]}
    </span>
  );
}
