import type { Task } from "@/types/task";

/** Remaining estimate hours for one task (real time reduces estimate). */
export function remainingEstimateHours(task: Task): number {
  return Math.max(0, task.estimatedTime - task.realTime);
}

/**
 * View-only cumulative: walk `sortedTasks` in display order; only incomplete,
 * non-missed tasks contribute `remainingEstimateHours`. Others map to `null` (show "—").
 */
export function cumulativeRemainingInDisplayOrder(
  sortedTasks: Task[],
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  let sum = 0;
  for (const t of sortedTasks) {
    const contributes = !t.completion && !t.missed;
    if (contributes) {
      sum += remainingEstimateHours(t);
      map.set(t.id, sum);
    } else {
      map.set(t.id, null);
    }
  }
  return map;
}
