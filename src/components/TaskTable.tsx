import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Priority, Task } from "@/types/task";
import { isOverdue } from "@/types/task";
import { cumulativeRemainingInDisplayOrder } from "@/lib/cumulativeDisplayOrder";

type EditCell =
  | { taskId: string; field: "estimatedTime" | "realTime" | "deadline" | "priority" }
  | null;

type Props = {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onUpdateField: (id: string, patch: Partial<Omit<Task, "id">>) => void;
  onCompletionChange: (id: string, checked: boolean) => void;
  onMissedChange: (id: string, checked: boolean) => void;
};

function formatCumulative(n: number | null | undefined): string {
  if (n == null) return "—";
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function priorityClass(p: Priority): string {
  switch (p) {
    case "High":
      return "priority-pill priority-high";
    case "Medium":
      return "priority-pill priority-medium";
    case "Low":
      return "priority-pill priority-low";
  }
}

function prioritySelectClass(p: Priority): string {
  const slug = p.toLowerCase();
  return `cell-select priority-select priority-select--${slug}`;
}

function tryShowDatePicker(el: HTMLInputElement) {
  if (typeof el.showPicker === "function") {
    try {
      el.showPicker();
    } catch {
      /* ignore */
    }
  }
}

export function TaskTable({
  tasks,
  onOpenTask,
  onUpdateField,
  onCompletionChange,
  onMissedChange,
}: Props) {
  const today = new Date();
  const [editing, setEditing] = useState<EditCell>(null);
  const [draft, setDraft] = useState("");
  const prioritySelectRef = useRef<HTMLSelectElement>(null);

  const cumulativeById = useMemo(
    () => cumulativeRemainingInDisplayOrder(tasks),
    [tasks],
  );

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

  useLayoutEffect(() => {
    if (editing?.field !== "priority") return;
    const sel = prioritySelectRef.current;
    if (!sel) return;
    sel.focus();
    try {
      if ("showPicker" in sel) {
        (sel as any).showPicker();
      }
    } catch (err) {
      // Ignore if unsupported or fails
    }
  }, [editing]);

  const beginEdit = (
    task: Task,
    field: NonNullable<EditCell>["field"],
  ) => {
    setEditing({ taskId: task.id, field });
    if (field === "estimatedTime") setDraft(String(task.estimatedTime));
    else if (field === "realTime") setDraft(String(task.realTime));
    else if (field === "deadline") setDraft(task.deadline ?? "");
    else if (field === "priority") setDraft(task.priority);
  };

  const commitDraft = (task: Task) => {
    if (!editing || editing.taskId !== task.id) return;
    const { field } = editing;
    if (field === "estimatedTime") {
      const n = Number(draft);
      onUpdateField(task.id, {
        estimatedTime: Number.isFinite(n) ? n : 0,
      });
    } else if (field === "realTime") {
      const n = Number(draft);
      onUpdateField(task.id, { realTime: Number.isFinite(n) ? n : 0 });
    } else if (field === "deadline") {
      onUpdateField(task.id, {
        deadline: draft.trim() === "" ? null : draft,
      });
    } else if (field === "priority") {
      const p = draft as Priority;
      if (p === "High" || p === "Medium" || p === "Low") {
        onUpdateField(task.id, { priority: p });
      }
    }
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th scope="col">Task name</th>
            <th scope="col" className="col-wide-only">
              Est. (h)
            </th>
            <th scope="col" className="col-wide-only">
              Real (h)
            </th>
            <th scope="col">Deadline</th>
            <th scope="col">Priority</th>
            <th scope="col">Done</th>
            <th scope="col" className="col-wide-only">
              Missed
            </th>
            <th
              scope="col"
              className="col-wide-only"
              title="Running sum of max(0, estimated − real) for incomplete, not-missed tasks in table order"
            >
              Cumulative (h)
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = isOverdue(task, today);
            let rowClass = "task-row";
            if (task.completion) rowClass += " task-row-done";
            else if (task.missed) rowClass += " task-row-missed";
            else if (overdue) rowClass += " task-row-overdue";

            const cum = cumulativeById.get(task.id);
            const effectivePriority: Priority =
              editing?.taskId === task.id && editing.field === "priority"
                ? draft === "High" || draft === "Medium" || draft === "Low"
                  ? draft
                  : task.priority
                : task.priority;

            return (
              <tr key={task.id} className={rowClass}>
                <td>
                  <button
                    type="button"
                    className="task-name-btn"
                    onClick={() => onOpenTask(task)}
                  >
                    {task.name}
                  </button>
                </td>
                <td
                  className="editable col-wide-only"
                  onClick={() => beginEdit(task, "estimatedTime")}
                >
                  {editing?.taskId === task.id &&
                  editing.field === "estimatedTime" ? (
                    <input
                      className="cell-input"
                      type="number"
                      step="any"
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitDraft(task)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <span className="cell-display">{task.estimatedTime}</span>
                  )}
                </td>
                <td
                  className="editable col-wide-only"
                  onClick={() => beginEdit(task, "realTime")}
                >
                  {editing?.taskId === task.id && editing.field === "realTime" ? (
                    <input
                      className="cell-input"
                      type="number"
                      step="any"
                      value={draft}
                      autoFocus
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitDraft(task)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  ) : (
                    <span className="cell-display">{task.realTime}</span>
                  )}
                </td>
                <td
                  className={`editable deadline-cell ${overdue && !task.completion ? "past-due" : ""}`}
                  onClick={() => beginEdit(task, "deadline")}
                >
                  {overdue && !task.completion ? (
                    <span className="past-due-badge" title="Past deadline">
                      Past due
                    </span>
                  ) : null}
                  {editing?.taskId === task.id && editing.field === "deadline" ? (
                    <input
                      className="cell-input"
                      type="date"
                      value={draft}
                      autoFocus
                      onFocus={(e) => tryShowDatePicker(e.currentTarget)}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitDraft(task)}
                    />
                  ) : (
                    <span className="cell-display">
                      {task.deadline ?? "—"}
                    </span>
                  )}
                </td>
                <td
                  className="editable"
                  onClick={() => beginEdit(task, "priority")}
                >
                  {editing?.taskId === task.id && editing.field === "priority" ? (
                    <select
                      ref={prioritySelectRef}
                      className={prioritySelectClass(effectivePriority)}
                      value={draft}
                      aria-label="Priority"
                      onChange={(e) => {
                        const v = e.target.value as Priority;
                        setDraft(v);
                        onUpdateField(task.id, { priority: v });
                        setEditing(null);
                        setDraft("");
                      }}
                      onBlur={() => {
                        if (editing?.taskId === task.id) commitDraft(task);
                      }}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  ) : (
                    <span className={`cell-display ${priorityClass(task.priority)}`}>
                      {task.priority}
                    </span>
                  )}
                </td>
                <td className="center">
                  <input
                    type="checkbox"
                    checked={task.completion}
                    aria-label="Completion"
                    onChange={(e) => {
                      onCompletionChange(task.id, e.target.checked);
                      e.currentTarget.blur();
                    }}
                  />
                </td>
                <td className="center col-wide-only">
                  <input
                    type="checkbox"
                    checked={task.missed}
                    aria-label="Missed"
                    onChange={(e) => {
                      onMissedChange(task.id, e.target.checked);
                      e.currentTarget.blur();
                    }}
                  />
                </td>
                <td className="readonly cumulative col-wide-only">
                  {formatCumulative(cum)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
