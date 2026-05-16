import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskAllocation } from "@/types/taskAllocation";
import { createSupabaseAllocationRepository } from "@/data/supabaseAllocationRepository";
import { localAllocationRepository } from "@/data/localAllocationRepository";
import { getSupabaseClient } from "@/lib/supabaseClient";

function createRepository() {
  const supabase = getSupabaseClient();
  if (supabase) return createSupabaseAllocationRepository(supabase);
  return localAllocationRepository;
}

export function useAllocations() {
  const [allocations, setAllocations] = useState<TaskAllocation[]>([]);
  const allocationsRef = useRef<TaskAllocation[]>([]);
  allocationsRef.current = allocations;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repo = useMemo(() => createRepository(), []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await repo.list();
      setAllocations(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setAllocation = useCallback(
    async (taskId: string, date: string, allocatedHours: number) => {
      setError(null);
      try {
        await repo.setAllocation(taskId, date, allocatedHours);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
      }
    },
    [repo, refresh],
  );

  const removeAllocation = useCallback(
    async (taskId: string, date: string) => {
      setError(null);
      try {
        await repo.removeAllocation(taskId, date);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
      }
    },
    [repo, refresh],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const a of allocations) {
      if (!map.has(a.date)) {
        map.set(a.date, {});
      }
      map.get(a.date)![a.taskId] = a.allocatedHours;
    }
    return map;
  }, [allocations]);

  const datesByTask = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const a of allocations) {
      if (!map.has(a.taskId)) {
        map.set(a.taskId, {});
      }
      map.get(a.taskId)![a.date] = a.allocatedHours;
    }
    return map;
  }, [allocations]);

  return {
    allocations,
    tasksByDate,
    datesByTask,
    setAllocation,
    removeAllocation,
    loading,
    error,
    refresh,
  };
}
