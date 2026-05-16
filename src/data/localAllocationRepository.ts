import type { AllocationRepository } from "./allocationRepository";
import { type TaskAllocation, createAllocationId } from "@/types/taskAllocation";

const STORAGE_KEY = "task_allocations";

export const localAllocationRepository: AllocationRepository = {
  async list(): Promise<TaskAllocation[]> {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  async setAllocation(taskId: string, date: string, allocatedHours: number): Promise<void> {
    const allocations = await this.list();
    const existingIndex = allocations.findIndex(a => a.taskId === taskId && a.date === date);

    if (existingIndex >= 0) {
      if (allocatedHours <= 0) {
        allocations.splice(existingIndex, 1);
      } else {
        allocations[existingIndex].allocatedHours = allocatedHours;
      }
    } else {
      if (allocatedHours > 0) {
        allocations.push({
          id: createAllocationId(),
          taskId,
          date,
          allocatedHours,
        });
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allocations));
  },

  async removeAllocation(taskId: string, date: string): Promise<void> {
    const allocations = await this.list();
    const updated = allocations.filter(a => !(a.taskId === taskId && a.date === date));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};
