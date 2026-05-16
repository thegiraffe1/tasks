import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskAllocation } from "@/types/taskAllocation";
import type { AllocationRepository } from "./allocationRepository";

type DbTaskAllocation = {
  id: string;
  task_id: string;
  date: string;
  allocated_hours: number;
};

type DbUpsert = {
  task_id: string;
  date: string;
  allocated_hours: number;
};

function fromRow(row: DbTaskAllocation): TaskAllocation {
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    allocatedHours: row.allocated_hours,
  };
}

export function createSupabaseAllocationRepository(
  client: SupabaseClient,
): AllocationRepository {
  return {
    async list() {
      const { data, error } = await client.from("task_allocations").select("*");
      if (error) throw error;
      return (data as DbTaskAllocation[]).map(fromRow);
    },

    async setAllocation(taskId, date, allocatedHours) {
      if (allocatedHours <= 0) {
        const { error } = await client
          .from("task_allocations")
          .delete()
          .match({ task_id: taskId, date });
        if (error) throw error;
      } else {
        const row: DbUpsert = { task_id: taskId, date, allocated_hours: allocatedHours };
        const { error } = await client
          .from("task_allocations")
          .upsert(row, { onConflict: 'task_id,date' });
        if (error) throw error;
      }
    },

    async removeAllocation(taskId, date) {
      const { error } = await client
        .from("task_allocations")
        .delete()
        .match({ task_id: taskId, date });
      if (error) throw error;
    },
  };
}
