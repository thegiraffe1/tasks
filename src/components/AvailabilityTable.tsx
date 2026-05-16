import { useEffect, useState } from "react";
import { 
  getDynamicAvailableTimeHours, 
  getAvailabilityState, 
  formatAvailabilityDate,
  formatTime12Hour
} from "@/types/availability";
import type { Availability } from "@/types/availability";

type EditCell = 
  | { id: string; field: "startTime" | "endTime" }
  | null;

type Props = {
  availabilities: Availability[];
  tasksByDate: Map<string, Record<string, number>>;
  onOpenAvailability: (a: Availability) => void;
  onUpdateField: (id: string, patch: Partial<Availability>) => void;
};

export function AvailabilityTable({
  availabilities,
  tasksByDate,
  onOpenAvailability,
  onUpdateField,
}: Props) {
  const [now, setNow] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [editing, setEditing] = useState<EditCell>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 720);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(null);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const beginEdit = (a: Availability, field: "startTime" | "endTime") => {
    setEditing({ id: a.id, field });
    setDraft(field === "startTime" ? a.startTime : a.endTime);
  };

  const commitDraft = (a: Availability) => {
    if (!editing || editing.id !== a.id) return;
    if (editing.field === "startTime") {
      onUpdateField(a.id, { startTime: draft });
    } else if (editing.field === "endTime") {
      onUpdateField(a.id, { endTime: draft });
    }
    setEditing(null);
    setDraft("");
  };

  function tryShowTimePicker(el: HTMLInputElement) {
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        /* ignore */
      }
    }
  }

  let cumulative = 0;

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Start Time</th>
            <th scope="col">End Time</th>
            <th scope="col" className="col-wide-only">Allocated Tasks</th>
            <th scope="col">Available (h)</th>
            <th scope="col" className="col-wide-only">Cumulative (h)</th>
          </tr>
        </thead>
        <tbody>
          {availabilities.map((a) => {
            const hours = getDynamicAvailableTimeHours(a, now);
            cumulative += hours;
            const state = getAvailabilityState(a, now);
            
            let rowClass = "task-row";
            if (state === "past") rowClass += " availability-row-past";
            else if (state === "active") rowClass += " availability-row-active";

            const allocationsForDate = tasksByDate.get(a.date) || {};
            const allocatedTaskIds = Object.keys(allocationsForDate);
            const totalAllocatedHours = allocatedTaskIds.reduce((sum, taskId) => sum + allocationsForDate[taskId], 0);

            return (
              <tr key={a.id} className={rowClass}>
                <td>
                  <button
                    className="task-name-btn"
                    type="button"
                    onClick={() => onOpenAvailability(a)}
                  >
                    {formatAvailabilityDate(a.date, isMobile)}
                  </button>
                </td>
                <td 
                  className="editable"
                  onClick={() => beginEdit(a, "startTime")}
                >
                  {editing?.id === a.id && editing.field === "startTime" ? (
                    <input
                      className="cell-input"
                      type="time"
                      value={draft}
                      autoFocus
                      onFocus={(e) => tryShowTimePicker(e.currentTarget)}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitDraft(a)}
                    />
                  ) : (
                    <span className="cell-display">{formatTime12Hour(a.startTime)}</span>
                  )}
                </td>
                <td 
                  className="editable"
                  onClick={() => beginEdit(a, "endTime")}
                >
                  {editing?.id === a.id && editing.field === "endTime" ? (
                    <input
                      className="cell-input"
                      type="time"
                      value={draft}
                      autoFocus
                      onFocus={(e) => tryShowTimePicker(e.currentTarget)}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitDraft(a)}
                    />
                  ) : (
                    <span className="cell-display">{formatTime12Hour(a.endTime)}</span>
                  )}
                </td>
                <td className="readonly col-wide-only">
                  {allocatedTaskIds.length > 0 ? `${allocatedTaskIds.length} task(s) (${totalAllocatedHours.toFixed(1)}h)` : "—"}
                </td>
                <td className="readonly">
                  {hours.toFixed(2)}
                </td>
                <td className="readonly cumulative col-wide-only">
                  {cumulative.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
