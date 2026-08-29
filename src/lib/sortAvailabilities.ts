import type { Availability } from "@/types/availability";

export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 0 = Today, 1 = Future, 2 = Past */
function availabilityBucket(a: Availability, todayStr: string): number {
  if (!a.date) return 1;
  if (a.date === todayStr) return 0;
  if (a.date > todayStr) return 1;
  return 2;
}

function padTime(t: string): string {
  if (!t) return "00:00";
  return t.padStart(5, "0");
}

/**
 * Sorts availabilities: Today > Future in floating section (chronological),
 * then all Past availabilities in reverse chronological order.
 */
export function sortAvailabilities(
  availabilities: Availability[],
  now: Date = new Date(),
): Availability[] {
  const todayStr = getLocalDateString(now);

  return [...availabilities].sort((a, b) => {
    const ba = availabilityBucket(a, todayStr);
    const bb = availabilityBucket(b, todayStr);
    if (ba !== bb) return ba - bb;

    // Bucket 0: Today -> chronological order (start time asc, end time asc)
    if (ba === 0) {
      const st = padTime(a.startTime).localeCompare(padTime(b.startTime));
      if (st !== 0) return st;
      const et = padTime(a.endTime).localeCompare(padTime(b.endTime));
      if (et !== 0) return et;
      return a.id.localeCompare(b.id);
    }

    // Bucket 1: Future -> chronological order (date asc, start time asc, end time asc)
    if (ba === 1) {
      const d = (a.date || "").localeCompare(b.date || "");
      if (d !== 0) return d;
      const st = padTime(a.startTime).localeCompare(padTime(b.startTime));
      if (st !== 0) return st;
      const et = padTime(a.endTime).localeCompare(padTime(b.endTime));
      if (et !== 0) return et;
      return a.id.localeCompare(b.id);
    }

    // Bucket 2: Past -> reverse chronological order (date desc, start time desc, end time desc)
    const d = (b.date || "").localeCompare(a.date || "");
    if (d !== 0) return d;
    const st = padTime(b.startTime).localeCompare(padTime(a.startTime));
    if (st !== 0) return st;
    const et = padTime(b.endTime).localeCompare(padTime(a.endTime));
    if (et !== 0) return et;
    return a.id.localeCompare(b.id);
  });
}
