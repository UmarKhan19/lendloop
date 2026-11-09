import { ConvexError } from "convex/values";

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ConvexError) {
    return typeof error.data === "string" ? error.data : fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
