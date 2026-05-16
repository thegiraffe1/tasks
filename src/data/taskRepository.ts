import type { Task } from "@/types/task";

export type TaskRepository = {
  list(): Promise<Task[]>;
  upsert(task: Task): Promise<void>;
  remove(id: string): Promise<void>;
};
