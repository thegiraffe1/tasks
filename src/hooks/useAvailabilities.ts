import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Availability } from "@/types/availability";
import { createAvailabilityId } from "@/types/availability";
import { createLocalAvailabilityRepository } from "@/data/localAvailabilityRepository";
import { createSupabaseAvailabilityRepository } from "@/data/supabaseAvailabilityRepository";
import { getSupabaseClient } from "@/lib/supabaseClient";

function createRepository() {
  const supabase = getSupabaseClient();
  if (supabase) return createSupabaseAvailabilityRepository(supabase);
  return createLocalAvailabilityRepository();
}

export function useAvailabilities() {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const availabilitiesRef = useRef<Availability[]>([]);
  availabilitiesRef.current = availabilities;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repo = useMemo(() => createRepository(), []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await repo.list();
      setAvailabilities(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as any)?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistUpsert = useCallback(
    async (availability: Availability) => {
      setError(null);
      try {
        await repo.upsert(availability);
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

  const addAvailability = useCallback(
    async (input: {
      date: string;
      startTime: string;
      endTime: string;
    }) => {
      const availability: Availability = {
        id: createAvailabilityId(),
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
      };
      await persistUpsert(availability);
    },
    [persistUpsert],
  );

  const updateAvailability = useCallback(
    async (id: string, patch: Partial<Omit<Availability, "id">>) => {
      const prev = availabilitiesRef.current.find((a) => a.id === id);
      if (!prev) return;
      const next = { ...prev, ...patch };
      await persistUpsert(next);
    },
    [persistUpsert],
  );

  const replaceAvailability = useCallback(
    async (availability: Availability) => {
      await persistUpsert(availability);
    },
    [persistUpsert],
  );

  return {
    availabilities,
    loading,
    error,
    refresh,
    addAvailability,
    updateAvailability,
    replaceAvailability,
    removeAvailability: persistRemove,
  };
}
