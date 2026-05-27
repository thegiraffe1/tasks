import type { SupabaseClient } from "@supabase/supabase-js";
import type { Priority, Task } from "@/types/task";
import type { TaskRepository } from "@/data/taskRepository";

type DbTask = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  estimated_time: number;
  real_time: number;
  deadline: string | null;
  priority: string;
  completion: boolean;
  missed: boolean;
  updated_at: string;
};

type DbUpsert = {
  id: string;
  name: string;
  description: string | null;
  estimated_time: number;
  real_time: number;
  deadline: string | null;
  priority: string;
  completion: boolean;
  missed: boolean;
  updated_at: string;
};

function isPriority(v: string): v is Priority {
  return v === "High" || v === "Medium" || v === "Low";
}

function fromRow(row: DbTask): Task {
  const p = row.priority;
  if (!isPriority(p)) throw new Error(`Invalid priority: ${row.priority}`);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    estimatedTime: row.estimated_time,
    realTime: row.real_time,
    deadline: row.deadline,
    priority: p,
    completion: row.completion,
    missed: row.missed,
    updatedAt: row.updated_at,
  };
}

function toUpsertPayload(task: Task): DbUpsert {
  return {
    id: task.id,
    name: task.name,
    description: task.description ?? null,
    estimated_time: task.estimatedTime,
    real_time: task.realTime,
    deadline: task.deadline,
    priority: task.priority,
    completion: task.completion,
    missed: task.missed,
    updated_at: task.updatedAt,
  };
}

export function createSupabaseTaskRepository(
  client: SupabaseClient,
): TaskRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as DbTask[]).map(fromRow);
    },
    async upsert(task) {
      const row = toUpsertPayload(task);
      const { error } = await client.from("tasks").upsert(row, {
        onConflict: "id",
      });
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await client.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
