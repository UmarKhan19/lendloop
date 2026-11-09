// Shared source of truth for tool categories and conditions. This module must
// stay free of server-only imports so the frontend can use it too.
export const TOOL_CATEGORIES = [
  "Power Tools",
  "Hand Tools",
  "Gardening",
  "Painting & Decorating",
  "Plumbing",
  "Electrical",
  "Automotive",
  "Cleaning",
  "Ladders & Access Equipment",
  "Other",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
] as const;

export type ToolCondition = (typeof TOOL_CONDITIONS)[number];

export function isToolCategory(value: string): value is ToolCategory {
  return (TOOL_CATEGORIES as readonly string[]).includes(value);
}

export function isToolCondition(value: string): value is ToolCondition {
  return (TOOL_CONDITIONS as readonly string[]).includes(value);
}
