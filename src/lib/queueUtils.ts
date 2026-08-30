import type { Priority, Task } from "@/types/task";
import { priorityRank, toLocalDateString } from "@/types/task";
import { sortTasks } from "./sortTasks";

export const DEFAULT_QUEUE = "Tasks";

/** Priority weights retained for scoring compatibility */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  High: 4,
  Medium: 1,
  Low: 0.25,
};

export type QueueUrgencyTier = "overdue" | "today" | "upcoming" | "no-deadline" | "empty";

export type PriorityHours = {
  High: number;
  Medium: number;
  Low: number;
};

export type QueueGroup = {
  name: string;
  tasks: Task[];
  tier: QueueUrgencyTier;
  mostUrgentDeadline: string | null;
  urgencyDays: number | null;
  highestPriorityOnUrgentDate: Priority | null;
  priorityHoursOnUrgentDate: PriorityHours;
  totalActiveHours: number;
  queueWidePriorityHours: PriorityHours;
  score: number;
};

/**
 * Calculates remaining active hours on a task.
 */
export function getTaskRemainingHours(task: Task): number {
  if (task.completion || task.missed) return 0;
  const remaining = Math.max(0, task.estimatedTime - task.realTime);
  return remaining > 0 ? remaining : (task.estimatedTime > 0 ? task.estimatedTime : 0);
}

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
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates legacy task urgency score for compatibility.
 */
export function calculateTaskScore(task: Task, today: Date = new Date()): number {
  if (task.completion || task.missed) return 0;

  const hours = getTaskRemainingHours(task) || 1;
  const weight = PRIORITY_WEIGHTS[task.priority] ?? 1;
  const baseScore = weight * hours;
  const days = getDaysUntilDue(task.deadline, today);

  if (days < 0) {
    return baseScore * Math.pow(10, Math.abs(days));
  } else {
    const daysUntilDue = Math.max(days, 0.1);
    return baseScore * (10 / daysUntilDue);
  }
}

/**
 * Sums task scores for all active tasks in a queue.
 */
export function calculateQueueScore(queueTasks: Task[], today: Date = new Date()): number {
  return queueTasks.reduce((sum, task) => {
    if (task.completion || task.missed) return sum;
    return sum + calculateTaskScore(task, today);
  }, 0);
}

/**
 * Analyzes active tasks in a queue and returns full metrics for deterministic ranking.
 */
export function buildQueueGroup(name: string, activeTasks: Task[], today: Date = new Date()): QueueGroup {
  // Sort internal tasks so most urgent appears first
  const sortedTasks = sortTasks(activeTasks, today);

  if (sortedTasks.length === 0) {
    return {
      name,
      tasks: [],
      tier: "empty",
      mostUrgentDeadline: null,
      urgencyDays: null,
      highestPriorityOnUrgentDate: null,
      priorityHoursOnUrgentDate: { High: 0, Medium: 0, Low: 0 },
      totalActiveHours: 0,
      queueWidePriorityHours: { High: 0, Medium: 0, Low: 0 },
      score: 0,
    };
  }

  const todayStr = toLocalDateString(today);
  const tasksWithDeadline = sortedTasks.filter((t) => t.deadline != null);

  let tier: QueueUrgencyTier;
  let mostUrgentDeadline: string | null = null;
  let urgencyDays: number | null = null;
  let urgentDateTasks: Task[] = [];

  if (tasksWithDeadline.length > 0) {
    // Earliest deadline among active tasks
    mostUrgentDeadline = tasksWithDeadline.reduce(
      (min, t) => (!min || (t.deadline && t.deadline < min) ? t.deadline : min),
      tasksWithDeadline[0].deadline
    )!;

    urgencyDays = getDaysUntilDue(mostUrgentDeadline, today);
    if (mostUrgentDeadline < todayStr) {
      tier = "overdue";
    } else if (mostUrgentDeadline === todayStr) {
      tier = "today";
    } else {
      tier = "upcoming";
    }

    urgentDateTasks = sortedTasks.filter((t) => t.deadline === mostUrgentDeadline);
  } else {
    tier = "no-deadline";
    mostUrgentDeadline = null;
    urgencyDays = null;
    urgentDateTasks = sortedTasks;
  }

  // Find highest priority on the most urgent date (or in queue if no deadlines)
  const bestRank = Math.min(...urgentDateTasks.map((t) => priorityRank(t.priority)));
  const highestPriorityOnUrgentDate: Priority =
    bestRank === 0 ? "High" : bestRank === 1 ? "Medium" : "Low";

  // Calculate hours on urgent date by priority
  const priorityHoursOnUrgentDate: PriorityHours = { High: 0, Medium: 0, Low: 0 };
  for (const t of urgentDateTasks) {
    priorityHoursOnUrgentDate[t.priority] += getTaskRemainingHours(t);
  }

  // Calculate queue-wide priority hours and total active hours
  const queueWidePriorityHours: PriorityHours = { High: 0, Medium: 0, Low: 0 };
  let totalActiveHours = 0;
  for (const t of sortedTasks) {
    const hrs = getTaskRemainingHours(t);
    queueWidePriorityHours[t.priority] += hrs;
    totalActiveHours += hrs;
  }

  const score = calculateQueueScore(sortedTasks, today);

  return {
    name,
    tasks: sortedTasks,
    tier,
    mostUrgentDeadline,
    urgencyDays,
    highestPriorityOnUrgentDate,
    priorityHoursOnUrgentDate,
    totalActiveHours: Math.round(totalActiveHours * 100) / 100,
    queueWidePriorityHours,
    score,
  };
}

/**
 * Deterministic queue comparison implementing the definitive priority hierarchy:
 * 1. Queue has overdue task (earliest overdue deadline first).
 * 2. Queue has task due on the day (today).
 * 3. Queue has task due in coming days (soonest upcoming deadline first).
 * 4. Queue has tasks without deadlines.
 * 5. Empty queue (all tasks completed/missed).
 *
 * Tie-breakers for queues with tasks due most urgently on the same date:
 * - Highest priority among tasks on that date (High > Medium > Low).
 * - Hours of tasks per priority on that date (High hours -> Medium hours -> Low hours).
 * - Secondary: Queue-wide priority hours (High -> Medium -> Low).
 * - Tertiary: Alphabetical by queue name.
 */
export function compareQueueGroups(a: QueueGroup, b: QueueGroup): number {
  // 1. Non-empty queues rank before empty queues
  const aHasTasks = a.tasks.length > 0;
  const bHasTasks = b.tasks.length > 0;
  if (aHasTasks !== bHasTasks) {
    return aHasTasks ? -1 : 1;
  }
  if (!aHasTasks && !bHasTasks) {
    return a.name.localeCompare(b.name);
  }

  // 2. Queues with deadline tasks rank before queues without any deadlines
  const aHasDeadline = a.mostUrgentDeadline != null;
  const bHasDeadline = b.mostUrgentDeadline != null;
  if (aHasDeadline !== bHasDeadline) {
    return aHasDeadline ? -1 : 1;
  }

  // 3. Compare most urgent deadlines (date ascending)
  // This inherently covers:
  // - Tier 1: Overdue dates (earlier overdue date < later overdue date)
  // - Tier 2: Today (today date)
  // - Tier 3: Coming days (soonest future date < later future date)
  if (a.mostUrgentDeadline != null && b.mostUrgentDeadline != null) {
    const deadlineComp = a.mostUrgentDeadline.localeCompare(b.mostUrgentDeadline);
    if (deadlineComp !== 0) {
      return deadlineComp;
    }
  }

  // 4. Tie-breaking for same urgent date (or both no deadline):
  // 4a. Highest priority of tasks on that date (High > Medium > Low)
  const aRank = a.highestPriorityOnUrgentDate ? priorityRank(a.highestPriorityOnUrgentDate) : 999;
  const bRank = b.highestPriorityOnUrgentDate ? priorityRank(b.highestPriorityOnUrgentDate) : 999;
  if (aRank !== bRank) {
    return aRank - bRank;
  }

  // 4b. Hours of tasks per priority on that date: High hours -> Medium hours -> Low hours
  if (b.priorityHoursOnUrgentDate.High !== a.priorityHoursOnUrgentDate.High) {
    return b.priorityHoursOnUrgentDate.High - a.priorityHoursOnUrgentDate.High;
  }
  if (b.priorityHoursOnUrgentDate.Medium !== a.priorityHoursOnUrgentDate.Medium) {
    return b.priorityHoursOnUrgentDate.Medium - a.priorityHoursOnUrgentDate.Medium;
  }
  if (b.priorityHoursOnUrgentDate.Low !== a.priorityHoursOnUrgentDate.Low) {
    return b.priorityHoursOnUrgentDate.Low - a.priorityHoursOnUrgentDate.Low;
  }

  // 4c. Secondary tie-breaker across the whole queue: High hours -> Medium hours -> Low hours
  if (b.queueWidePriorityHours.High !== a.queueWidePriorityHours.High) {
    return b.queueWidePriorityHours.High - a.queueWidePriorityHours.High;
  }
  if (b.queueWidePriorityHours.Medium !== a.queueWidePriorityHours.Medium) {
    return b.queueWidePriorityHours.Medium - a.queueWidePriorityHours.Medium;
  }
  if (b.queueWidePriorityHours.Low !== a.queueWidePriorityHours.Low) {
    return b.queueWidePriorityHours.Low - a.queueWidePriorityHours.Low;
  }

  // 4d. Total active tasks count
  if (b.tasks.length !== a.tasks.length) {
    return b.tasks.length - a.tasks.length;
  }

  // 4e. Stable final tie-breaker: alphabetical by queue name
  return a.name.localeCompare(b.name);
}

/**
 * Groups active (non-completed, non-missed) tasks by queue and sorts queues
 * according to the definitive priority hierarchy.
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
    const group = buildQueueGroup(name, qTasks, today);
    result.push(group);
  }

  // Sort queues using the definitive hierarchy comparator
  result.sort(compareQueueGroups);

  return result;
}
