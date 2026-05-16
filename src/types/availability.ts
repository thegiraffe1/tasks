export type Availability = {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
};

export function createAvailabilityId(): string {
  return crypto.randomUUID();
}

/** Returns the static available time in hours between start and end. */
export function getAvailableTimeHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return 0;
  }

  const startMs = (startH * 60 + startM) * 60 * 1000;
  let endMs = (endH * 60 + endM) * 60 * 1000;

  if (endMs < startMs) {
    // If end time is before start time, assume it crosses midnight
    endMs += 24 * 60 * 60 * 1000;
  }

  return (endMs - startMs) / (1000 * 60 * 60);
}

export function getDynamicAvailableTimeHours(a: Availability, now: Date): number {
  const [startH, startM] = a.startTime.split(':').map(Number);
  const [endH, endM] = a.endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return 0;
  }

  const [aY, aM, aD] = a.date.split('-').map(Number);

  // Use local time
  const start = new Date(aY, aM - 1, aD, startH, startM);
  const end = new Date(aY, aM - 1, aD, endH, endM);

  if (end < start) {
    end.setDate(end.getDate() + 1); // Crosses midnight
  }

  if (now > end) {
    return 0; // Past
  } else if (now >= start && now <= end) {
    return (end.getTime() - now.getTime()) / (1000 * 60 * 60); // Active window
  } else {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Future
  }
}

export function getAvailabilityState(a: Availability, now: Date): "past" | "active" | "future" {
  const [startH, startM] = a.startTime.split(':').map(Number);
  const [endH, endM] = a.endTime.split(':').map(Number);
  
  if (!a.date) return "future";
  const [aY, aM, aD] = a.date.split('-').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return "future";
  }

  const start = new Date(aY, aM - 1, aD, startH, startM);
  const end = new Date(aY, aM - 1, aD, endH, endM);

  if (end < start) {
    end.setDate(end.getDate() + 1);
  }

  if (now > end) return "past";
  if (now >= start && now <= end) return "active";
  return "future";
}

export function formatAvailabilityDate(dateStr: string, isMobile: boolean): string {
  if (!dateStr) return "No date";
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (targetMidnight.getTime() === today.getTime()) return "Today";
  if (targetMidnight.getTime() === tomorrow.getTime()) return "Tomorrow";

  const diffYears = target.getFullYear() - today.getFullYear();
  const options: Intl.DateTimeFormatOptions = { 
    month: isMobile ? 'short' : 'long', 
    day: 'numeric' 
  };
  
  if (diffYears >= 1) {
    options.year = 'numeric';
  }
  
  return target.toLocaleDateString(undefined, options);
}

export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;

  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;

  const mFormatted = m < 10 ? `0${m}` : m.toString();
  return `${h}:${mFormatted} ${ampm}`;
}
