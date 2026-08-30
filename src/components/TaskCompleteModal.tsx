import { useEffect, useId, useRef, useState } from "react";
import type { Task } from "@/types/task";

export type TaskCompleteModalProps = {
  open: boolean;
  task: Task | null;
  parentTask?: Task | null;
  onClose: () => void;
  onConfirm: (taskId: string, realTime: number) => Promise<void>;
};

export function TaskCompleteModal({
  open,
  task,
  parentTask,
  onClose,
  onConfirm,
}: TaskCompleteModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [realTimeStr, setRealTimeStr] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !task) return;
    // If realTime was 0 before, default to estimatedTime; otherwise leave as current realTime
    const defaultVal = task.realTime > 0 ? task.realTime : task.estimatedTime;
    setRealTimeStr(String(defaultVal));
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !task) return null;

  const overlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(realTimeStr);
    const validHours = Number.isFinite(n) && n >= 0 ? n : 0;
    setSaving(true);
    try {
      await onConfirm(task.id, validHours);
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
      style={{ zIndex: 70 }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "420px", width: "100%" }}
      >
        <h2 id={titleId} className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>✓</span> Complete Task
        </h2>

        <p style={{ margin: "0 0 1rem", fontSize: "0.95rem", color: "#334155" }}>
          <strong>{task.name}</strong>
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span>How much time did this take? (hours)</span>
            <input
              ref={inputRef}
              type="number"
              step="any"
              min={0}
              value={realTimeStr}
              onChange={(e) => setRealTimeStr(e.target.value)}
              required
            />
          </label>

          {task.parentId && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#1e40af",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "6px",
                padding: "0.5rem 0.75rem",
              }}
            >
              💡 <strong>Subtask:</strong> Completing this will add the recorded real time to the parent task
              {parentTask ? ` (“${parentTask.name}”)` : ""}.
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: "1rem" }}>
            <div className="modal-actions-right">
              <button
                type="button"
                className="btn secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={saving}
                style={{ background: "#16a34a", borderColor: "#15803d" }}
              >
                {saving ? "Saving…" : "Complete Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
