export type TaskAllocation = {
  id: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  allocatedHours: number;
};

export function createAllocationId(): string {
  return crypto.randomUUID();
}
