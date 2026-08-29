import type { Priority, Task } from "@/types/task";
import { toLocalDateString } from "@/types/task";

export const DEFAULT_QUEUE = "Tasks";

/** Priority weights for queue ordering formula */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  High: 4,
  Medium: 1,
  Low: 0.25,
};

/** Multiplier base for overdue days: * 10^(overdue days) */
export const OVERDUE_EXPONENT_BASE = 10;

/** Fallback days until due when task has no specified deadline */
export const DEFAULT_DAYS_UNTIL_DUE = 14;

/**
 * Calculates days remaining until task deadline relative to `today`.
 * Negative values indicate overdue days.
 */
export function getDaysUntilDue(deadlineStr: string | null, today: Date = new Date()): number {
  if (!deadlineStr) return DEFAULT_DAYS_UNTIL_DUE;

  const todayStr = toLocalDateString(today);
  const todayDate = new Date(`${todayStr}T00:00:00`);
  const deadlineDate = new Date(`${deadlineStr}T00:00:00`);

  const diffMs = deadlineDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Easily adjustable formula for calculating a task's queue urgency score.
 * Formula:
 * - BaseScore = PriorityWeight * RemainingHours
 * - Future/Today: TaskScore = BaseScore * (1 / DaysUntilDue)
 * - Overdue: TaskScore = BaseScore * 2^(OverdueDays)
 */
export function calculateTaskScore(task: Task, today: Date = new Date()): number {
  if (task.completion || task.missed) return 0;

  const remaining = Math.max(0, task.estimatedTime - task.realTime);
  const hours = remaining > 0 ? remaining : (task.estimatedTime > 0 ? task.estimatedTime : 1);
  const weight = PRIORITY_WEIGHTS[task.priority] ?? 1;
  const baseScore = weight * hours;

  const days = getDaysUntilDue(task.deadline, today);

  if (days < 0) {
    const overdueDays = Math.abs(days);
    return baseScore * Math.pow(OVERDUE_EXPONENT_BASE, overdueDays);
  } else {
    const daysUntilDue = Math.max(days, 0.1); // prevent divide-by-zero
    return baseScore * (10 / daysUntilDue);
  }
}

/**
 * Sums task scores for all active (non-completed, non-missed) tasks in a queue.
 */
export function calculateQueueScore(queueTasks: Task[], today: Date = new Date()): number {
  return queueTasks.reduce((sum, task) => {
    if (task.completion || task.missed) return sum;
    return sum + calculateTaskScore(task, today);
  }, 0);
}

export type QueueGroup = {
  name: string;
  score: number;
  tasks: Task[];
};

/**
 * Groups active (non-completed, non-missed) tasks by queue and sorts queues by score in descending order.
 */
export function groupAndSortQueues(tasks: Task[], today: Date = new Date()): QueueGroup[] {
  const activeTasks = tasks.filter((t) => !t.completion && !t.missed);

  // Collect all unique queue names present in tasks, or at least DEFAULT_QUEUE
  const queueNamesSet = new Set<string>();
  queueNamesSet.add(DEFAULT_QUEUE);

  for (const t of tasks) {
    const q = t.queue?.trim() || DEFAULT_QUEUE;
    queueNamesSet.add(q);
  }

  const map = new Map<string, Task[]>();
  for (const q of queueNamesSet) {
    map.set(q, []);
  }

  for (const t of activeTasks) {
    const q = t.queue?.trim() || DEFAULT_QUEUE;
    if (!map.has(q)) {
      map.set(q, []);
    }
    map.get(q)!.push(t);
  }

  const result: QueueGroup[] = [];
  for (const [name, qTasks] of map.entries()) {
    const score = calculateQueueScore(qTasks, today);
    result.push({ name, score, tasks: qTasks });
  }

  // Sort by score descending; if equal, sort alphabetically by queue name
  result.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}
