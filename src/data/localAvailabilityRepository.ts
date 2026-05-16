import type { Availability } from "@/types/availability";
import type { AvailabilityRepository } from "@/data/availabilityRepository";

const STORAGE_KEY = "availabilities:v1";

function loadRaw(): Availability[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Availability[];
  } catch {
    return [];
  }
}

function saveRaw(availabilities: Availability[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(availabilities));
}

export function createLocalAvailabilityRepository(): AvailabilityRepository {
  return {
    async list() {
      return loadRaw();
    },
    async upsert(availability) {
      const availabilities = loadRaw();
      const i = availabilities.findIndex((a) => a.id === availability.id);
      if (i === -1) availabilities.push(availability);
      else availabilities[i] = availability;
      saveRaw(availabilities);
    },
    async remove(id) {
      saveRaw(loadRaw().filter((a) => a.id !== id));
    },
  };
}
