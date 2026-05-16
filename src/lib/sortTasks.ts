import type { Task } from "@/types/task";
import { isOverdue, priorityRank } from "@/types/task";

function compareDeadlineAscNullLast(a: string | null, b: string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a.localeCompare(b);
}

/** 0 = active incomplete, 1 = missed incomplete, 2 = completed */
function statusBucket(task: Task): number {
  if (task.completion) return 2;
  if (task.missed) return 1;
  return 0;
}

/** Table sort: completed last; missed incomplete below active incomplete; overdue first among active. */
export function sortTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return [...tasks].sort((a, b) => {
    const ba = statusBucket(a);
    const bb = statusBucket(b);
    if (ba !== bb) return ba - bb;

    if (ba === 0 && bb === 0) {
      const oa = isOverdue(a, now) ? 0 : 1;
      const ob = isOverdue(b, now) ? 0 : 1;
      if (oa !== ob) return oa - ob;
    }

    const d = compareDeadlineAscNullLast(a.deadline, b.deadline);
    if (d !== 0) return d;

    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;

    return a.id.localeCompare(b.id);
  });
}
