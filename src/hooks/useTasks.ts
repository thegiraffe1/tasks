import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/types/task";
import { createTaskId, nowIso } from "@/types/task";
import type { Priority } from "@/types/task";
import { createLocalTaskRepository } from "@/data/localTaskRepository";
import { createSupabaseTaskRepository } from "@/data/supabaseTaskRepository";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { sortTasks } from "@/lib/sortTasks";

function createRepository() {
  const supabase = getSupabaseClient();
  if (supabase) return createSupabaseTaskRepository(supabase);
  return createLocalTaskRepository();
}

/** Cannot be both done and missed: done wins if both true after merge. */
function normalizeDoneMissed(task: Task): Task {
  if (task.completion && task.missed) {
    return { ...task, missed: false };
  }
  return task;
}

function applyDoneMissedPatch(
  patch: Partial<Omit<Task, "id">>,
): Partial<Omit<Task, "id">> {
  const p = { ...patch };
  if (p.completion === true) p.missed = false;
  if (p.missed === true) p.completion = false;
  return p;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repo = useMemo(() => createRepository(), []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await repo.list();
      setTasks(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedTasks = useMemo(
    () => sortTasks(tasks, new Date()),
    [tasks],
  );

  const persistUpsert = useCallback(
    async (task: Task) => {
      setError(null);
      try {
        await repo.upsert(task);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
      }
    },
    [repo, refresh],
  );

  const persistRemove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await repo.remove(id);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
      }
    },
    [repo, refresh],
  );

  const addTask = useCallback(
    async (input: {
      name: string;
      description?: string;
      estimatedTime: number;
      deadline: string | null;
      priority: Priority;
    }) => {
      const task: Task = {
        id: createTaskId(),
        name: input.name.trim() || "Untitled",
        description: input.description?.trim() || undefined,
        estimatedTime: input.estimatedTime,
        realTime: 0,
        deadline: input.deadline,
        priority: input.priority,
        completion: false,
        missed: false,
        updatedAt: nowIso(),
      };
      await persistUpsert(task);
    },
    [persistUpsert],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Omit<Task, "id">>) => {
      const prev = tasksRef.current.find((t) => t.id === id);
      if (!prev) return;
      const merged = applyDoneMissedPatch(patch);
      const next = normalizeDoneMissed({
        ...prev,
        ...merged,
        updatedAt: nowIso(),
      });
      await persistUpsert(next);
    },
    [persistUpsert],
  );

  const replaceTask = useCallback(
    async (task: Task) => {
      await persistUpsert(
        normalizeDoneMissed({ ...task, updatedAt: nowIso() }),
      );
    },
    [persistUpsert],
  );

  return {
    tasks,
    sortedTasks,
    loading,
    error,
    refresh,
    addTask,
    updateTask,
    replaceTask,
    removeTask: persistRemove,
  };
}
