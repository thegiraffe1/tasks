export type Priority = "High" | "Medium" | "Low";

export type Task = {
  id: string;
  name: string;
  estimatedTime: number;
  realTime: number;
  deadline: string | null;
  priority: Priority;
  completion: boolean;
  missed: boolean;
  updatedAt: string;
};

export function priorityRank(p: Priority): number {
  switch (p) {
    case "High":
      return 0;
    case "Medium":
      return 1;
    case "Low":
      return 2;
  }
}

/** Local calendar `YYYY-MM-DD` for `d` (no UTC shift). */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(task: Task, today: Date): boolean {
  if (task.completion) return false;
  if (task.deadline == null) return false;
  return task.deadline < toLocalDateString(today);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createTaskId(): string {
  return crypto.randomUUID();
}
