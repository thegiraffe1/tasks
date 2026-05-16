import type { SupabaseClient } from "@supabase/supabase-js";
import type { Availability } from "@/types/availability";
import type { AvailabilityRepository } from "@/data/availabilityRepository";

type DbAvailability = {
  id: string;
  user_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  updated_at: string;
};

type DbUpsert = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  updated_at: string;
};

function fromRow(row: DbAvailability): Availability {
  // Database returns time with seconds, e.g., '14:30:00' or '14:30'.
  // We want 'HH:mm' for the frontend.
  const formatTime = (t: string) => t.substring(0, 5);

  return {
    id: row.id,
    date: row.date,
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
  };
}

function toUpsertPayload(availability: Availability): DbUpsert {
  return {
    id: availability.id,
    date: availability.date,
    start_time: availability.startTime,
    end_time: availability.endTime,
    updated_at: new Date().toISOString(),
  };
}

export function createSupabaseAvailabilityRepository(
  client: SupabaseClient,
): AvailabilityRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("availabilities")
        .select("*")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data as DbAvailability[]).map(fromRow);
    },
    async upsert(availability) {
      const row = toUpsertPayload(availability);
      const { error } = await client.from("availabilities").upsert(row, {
        onConflict: "id",
      });
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await client.from("availabilities").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
