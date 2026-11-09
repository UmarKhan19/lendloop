"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";

export default function AdminArchiveToolButton({
  toolId,
  toolName,
}: {
  toolId: Id<"tools">;
  toolName: string;
}) {
  const deleteTool = useMutation(api.tools.deleteTool);
  const [open, setOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setError(null);
    setIsArchiving(true);

    try {
      await deleteTool({ toolId });
      setOpen(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive “{toolName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The listing will disappear from browsing and moderation. Borrowing
            history, including approved loans, is preserved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isArchiving}
            onClick={handleArchive}
          >
            {isArchiving ? "Archiving…" : "Archive listing"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
