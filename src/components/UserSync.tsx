"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

export default function UserSync() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      hasSynced.current = false;
      return;
    }

    if (hasSynced.current) return;
    hasSynced.current = true;

    syncCurrentUser().catch((error: unknown) => {
      console.error("Failed to sync user with Convex:", error);
    });
  }, [isLoading, isAuthenticated, syncCurrentUser]);

  return null;
}
