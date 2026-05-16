import type { Availability } from "@/types/availability";

export type AvailabilityRepository = {
  list(): Promise<Availability[]>;
  upsert(availability: Availability): Promise<void>;
  remove(id: string): Promise<void>;
};
