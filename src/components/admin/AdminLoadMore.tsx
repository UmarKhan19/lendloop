"use client";

import { Button } from "@/components/ui/button";

export default function AdminLoadMore({
  canLoadMore,
  isLoading,
  isDone,
  onLoadMore,
  endLabel,
}: {
  canLoadMore: boolean;
  isLoading: boolean;
  isDone: boolean;
  onLoadMore: () => void;
  endLabel: string;
}) {
  if (!canLoadMore && !isLoading && !isDone) {
    return null;
  }

  if (canLoadMore || isLoading) {
    return (
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={onLoadMore}
          disabled={isLoading}
          className="rounded-full"
        >
          {isLoading ? "Loading…" : "Load more"}
        </Button>
      </div>
    );
  }

  return <p className="text-center text-sm text-muted-foreground">{endLabel}</p>;
}
