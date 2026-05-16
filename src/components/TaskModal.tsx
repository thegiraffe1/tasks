import { useEffect, useId, useRef, useState } from "react";
import type { Priority, Task } from "@/types/task";

export type TaskModalProps = {
  open: boolean;
  mode: "add" | "edit";
  task: Task | null;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    estimatedTime: number;
    deadline: string | null;
    priority: Priority;
  }) => Promise<void>;
  onSaveEdit: (task: Task) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
};

function newEmptyForm() {
  return {
    name: "",
    estimatedTime: "0",
    realTime: "0",
    deadline: "",
    priority: "Medium" as Priority,
    completion: false,
    missed: false,
  };
}

export function TaskModal({
  open,
  mode,
  task,
  onClose,
  onCreate,
  onSaveEdit,
  onDelete,
}: TaskModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(newEmptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && task) {
      setForm({
        name: task.name,
        estimatedTime: String(task.estimatedTime),
        realTime: String(task.realTime),
        deadline: task.deadline ?? "",
        priority: task.priority,
        completion: task.completion,
        missed: task.missed,
      });
    } else {
      setForm(newEmptyForm());
    }
  }, [open, mode, task]);

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

  const parseNum = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "add") {
        await onCreate({
          name: form.name,
          estimatedTime: parseNum(form.estimatedTime),
          deadline: form.deadline.trim() === "" ? null : form.deadline,
          priority: form.priority,
        });
      } else if (task) {
        const completion = form.completion;
        const missed =
          form.completion && form.missed ? false : form.missed;
        await onSaveEdit({
          ...task,
          name: form.name.trim() || "Untitled",
          estimatedTime: parseNum(form.estimatedTime),
          realTime: parseNum(form.realTime),
          deadline: form.deadline.trim() === "" ? null : form.deadline,
          priority: form.priority,
          completion,
          missed,
        });
      }
      onClose();
    } catch {
      // Parent sets global error; keep modal open so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    if (!window.confirm(`Delete “${task.name}”? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await onDelete(task.id);
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
          {mode === "add" ? "Add task" : "View / edit task"}
        </h2>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Task name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Estimated time (hours)</span>
            <input
              type="number"
              step="any"
              min={0}
              value={form.estimatedTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, estimatedTime: e.target.value }))
              }
              required
            />
          </label>
          {mode === "edit" ? (
            <label className="field">
              <span>Real time (hours)</span>
              <input
                type="number"
                step="any"
                min={0}
                value={form.realTime}
                onChange={(e) =>
                  setForm((f) => ({ ...f, realTime: e.target.value }))
                }
                required
              />
            </label>
          ) : null}
          <label className="field">
            <span>Deadline</span>
            <input
              type="date"
              value={form.deadline}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, deadline: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Priority</span>
            <select
              className={`priority-select priority-select--${form.priority.toLowerCase()}`}
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as Priority,
                }))
              }
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          {mode === "edit" ? (
            <div className="field-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.completion}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      completion: e.target.checked,
                      missed: e.target.checked ? false : f.missed,
                    }))
                  }
                />
                <span>Completion</span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.missed}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      missed: e.target.checked,
                      completion: e.target.checked ? false : f.completion,
                    }))
                  }
                />
                <span>Missed</span>
              </label>
            </div>
          ) : null}
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
