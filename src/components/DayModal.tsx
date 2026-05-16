import { useEffect, useId, useRef, useState, useMemo } from "react";
import type { Task } from "@/types/task";
import type { Availability } from "@/types/availability";
import { getDynamicAvailableTimeHours, formatTime12Hour, formatAvailabilityDate } from "@/types/availability";
import { remainingEstimateHours } from "@/lib/cumulativeDisplayOrder";
import "./DayModal.css";

export type DayModalProps = {
  open: boolean;
  dateStr: string | null;
  tasks: Task[];
  availabilities: Availability[];
  onClose: () => void;
};

function formatCumulative(n: number | null | undefined): string {
  if (n == null) return "—";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

export function DayModal({
  open,
  dateStr,
  tasks,
  availabilities,
  onClose,
}: DayModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mobileTab, setMobileTab] = useState<"tasks" | "avail">("tasks");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const cumulativeStats = useMemo(() => {
    if (!dateStr) return { taskTime: 0, availTime: 0 };

    const cumulativeTaskTime = tasks
      .filter(t => !t.completion && !t.missed && t.deadline && t.deadline <= dateStr)
      .reduce((sum, t) => sum + remainingEstimateHours(t), 0);

    // Cumulative availability up to this day
    const cumulativeAvailTime = availabilities
      .filter(a => a.date && a.date <= dateStr)
      .reduce((sum, a) => sum + getDynamicAvailableTimeHours(a, now), 0);

    return { taskTime: cumulativeTaskTime, availTime: cumulativeAvailTime };
  }, [dateStr, tasks, availabilities, now]);

  if (!open || !dateStr) return null;

  const overlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const dayTasks = tasks.filter(t => t.deadline === dateStr);
  const dayAvails = availabilities.filter(a => a.date === dateStr);
  
  const displayDate = formatAvailabilityDate(dateStr, false);

  return (
    <div
      className="modal-overlay"
      onMouseDown={overlayMouseDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="modal-panel day-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="day-modal-header">
          <h2 id={titleId} className="modal-title">
            {displayDate}
          </h2>
          <button type="button" className="btn linkish close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mobile-tab-toggle">
          <button 
            className={`btn ${mobileTab === 'tasks' ? 'primary' : 'secondary'} btn-sm`}
            onClick={() => setMobileTab('tasks')}
          >
            Tasks ({dayTasks.length})
          </button>
          <button 
            className={`btn ${mobileTab === 'avail' ? 'primary' : 'secondary'} btn-sm`}
            onClick={() => setMobileTab('avail')}
          >
            Availability ({dayAvails.length})
          </button>
        </div>

        <div className="day-modal-content">
          <div className={`day-modal-pane tasks-pane ${mobileTab === 'tasks' ? 'active' : ''}`}>
            <h3>Tasks</h3>
            <div className="pane-scroll">
              {dayTasks.length === 0 ? (
                <p className="muted">No tasks for this day.</p>
              ) : (
                <ul className="condensed-list">
                  {dayTasks.map(t => (
                    <li key={t.id} className={`condensed-item priority-${t.priority.toLowerCase()}`}>
                      <span className="item-name">{t.name}</span>
                      <span className="item-detail">{t.estimatedTime}h</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={`day-modal-pane avail-pane ${mobileTab === 'avail' ? 'active' : ''}`}>
            <h3>Availability</h3>
            <div className="pane-scroll">
              {dayAvails.length === 0 ? (
                <p className="muted">No availability for this day.</p>
              ) : (
                <ul className="condensed-list">
                  {dayAvails.map(a => {
                    const hrs = getDynamicAvailableTimeHours(a, now);
                    const displayTime = formatTime12Hour(a.startTime);
                    return (
                      <li key={a.id} className="condensed-item avail-item">
                        <span className="item-name">{displayTime} to {formatTime12Hour(a.endTime)}</span>
                        <span className="item-detail">{hrs.toFixed(2)}h</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="day-modal-footer">
          <div className="cumulative-stat">
            <span className="stat-label">Cumulative Task Est:</span>
            <span className="stat-value">{formatCumulative(cumulativeStats.taskTime)}h</span>
          </div>
          <div className="cumulative-stat">
            <span className="stat-label">Cumulative Avail:</span>
            <span className="stat-value">{formatCumulative(cumulativeStats.availTime)}h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
