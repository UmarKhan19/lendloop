import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function TrustedLenderBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300",
        className,
      )}
    >
      Trusted Lender
    </Badge>
  );
}
