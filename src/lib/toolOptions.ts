import type { ToolCondition } from "../../convex/toolOptions";

export {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  isToolCategory,
  isToolCondition,
} from "../../convex/toolOptions";
export type { ToolCategory, ToolCondition } from "../../convex/toolOptions";

export const TOOL_CONDITION_LABELS: Record<ToolCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function toolConditionLabel(condition: string): string {
  return TOOL_CONDITION_LABELS[condition as ToolCondition] ?? condition;
}
