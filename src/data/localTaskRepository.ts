import type { Task } from "@/types/task";
import type { TaskRepository } from "@/data/taskRepository";

const STORAGE_KEY = "tasks:v1";

function loadRaw(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Task[];
  } catch {
    return [];
  }
}

function saveRaw(tasks: Task[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function createLocalTaskRepository(): TaskRepository {
  return {
    async list() {
      return loadRaw();
    },
    async upsert(task) {
      const tasks = loadRaw();
      const i = tasks.findIndex((t) => t.id === task.id);
      if (i === -1) tasks.push(task);
      else tasks[i] = task;
      saveRaw(tasks);
    },
    async remove(id) {
      saveRaw(loadRaw().filter((t) => t.id !== id));
    },
  };
}
