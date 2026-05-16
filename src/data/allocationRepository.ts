import type { TaskAllocation } from "@/types/taskAllocation";

export type AllocationRepository = {
  list(): Promise<TaskAllocation[]>;
  setAllocation(taskId: string, date: string, allocatedHours: number): Promise<void>;
  removeAllocation(taskId: string, date: string): Promise<void>;
};
