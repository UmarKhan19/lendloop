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

export default function AdminTrustedLenderButton({
  userId,
  displayName,
  isTrustedLender,
}: {
  userId: Id<"users">;
  displayName: string;
  isTrustedLender: boolean;
}) {
  const grantTrustedLender = useMutation(api.admin.grantTrustedLender);
  const revokeTrustedLender = useMutation(api.admin.revokeTrustedLender);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionLabel = isTrustedLender ? "Revoke" : "Grant";

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (isTrustedLender) {
        await revokeTrustedLender({ userId });
      } else {
        await grantTrustedLender({ userId });
      }
      setOpen(false);
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    } finally {
      setIsSaving(false);
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
        <Button
          variant={isTrustedLender ? "destructive" : "outline"}
          size="sm"
        >
          {actionLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {actionLabel} Trusted Lender status for {displayName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTrustedLender
              ? "They will lose the Trusted Lender badge. Their role and ability to borrow or lend do not change."
              : "They will receive the Trusted Lender badge. This does not make them an admin and does not change their role."}
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
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={isTrustedLender ? "destructive" : "default"}
            disabled={isSaving}
            onClick={handleConfirm}
          >
            {isSaving
              ? "Saving…"
              : isTrustedLender
                ? "Revoke status"
                : "Grant status"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
