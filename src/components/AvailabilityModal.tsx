import { useEffect, useId, useRef, useState } from "react";
import type { Availability } from "@/types/availability";
import { toLocalDateString } from "@/types/task";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  availability: Availability | null;
  onClose: () => void;
  onCreate: (input: {
    date: string;
    startTime: string;
    endTime: string;
  }) => Promise<void>;
  onSaveEdit: (availability: Availability) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

export function AvailabilityModal({
  open,
  mode,
  availability,
  onClose,
  onCreate,
  onSaveEdit,
  onDelete,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && availability) {
      setDate(availability.date);
      setStartTime(availability.startTime);
      setEndTime(availability.endTime);
    } else {
      setDate(toLocalDateString(new Date()));
      setStartTime("09:00");
      setEndTime("17:00");
    }
    setSaving(false);
  }, [open, mode, availability]);

  useEffect(() => {
    if (!open || mode !== "add") return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    el?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const overlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "add") {
        await onCreate({
          date,
          startTime,
          endTime,
        });
      } else if (availability) {
        await onSaveEdit({
          ...availability,
          date,
          startTime,
          endTime,
        });
      }
      onClose();
    } catch (err) {
      // Parent sets global error; keep modal open so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!availability || !onDelete) return;
    if (!window.confirm("Delete this availability slot? This cannot be undone.")) return;
    setSaving(true);
    try {
      await onDelete(availability.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={overlayMouseDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          {mode === "add" ? "Add availability" : "View / edit availability"}
        </h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onFocus={(e) => {
                const el = e.currentTarget;
                if (typeof el.showPicker === "function") {
                  try {
                    el.showPicker();
                  } catch {
                    /* ignore */
                  }
                }
              }}
              required
            />
          </label>

          <label className="field">
            <span>Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>End time</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </label>

          <div className="modal-actions">
            {mode === "edit" && onDelete ? (
              <button
                type="button"
                className="btn danger"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                Delete
              </button>
            ) : null}
            <div className="modal-actions-right">
              <button type="button" className="btn secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
