import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Priority, Task } from "@/types/task";
import { createTaskId, nowIso } from "@/types/task";
import { DEFAULT_QUEUE, getDaysUntilDue } from "@/lib/queueUtils";

export type TaskModalProps = {
  open: boolean;
  mode: "add" | "edit";
  task: Task | null;
  allTasks?: Task[];
  existingQueues?: string[];
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description: string;
    estimatedTime: number;
    deadline: string | null;
    priority: Priority;
    queue: string;
    parentId?: string | null;
    subtaskIndex?: number | null;
  }) => Promise<Task | void>;
  onCreateSubtasksBatch?: (subtasks: Array<{
    name: string;
    description?: string;
    estimatedTime: number;
    deadline: string | null;
    priority: Priority;
    queue: string;
    parentId: string;
    subtaskIndex: number;
  }>) => Promise<Task[] | void>;
  onSaveEdit: (task: Task) => Promise<void>;
  onSaveTasksBatch?: (tasks: Task[]) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onOpenTask?: (task: Task) => void;
  onTriggerComplete?: (task: Task) => void;
};

function newEmptyForm() {
  return {
    name: "",
    description: "",
    estimatedTime: "0",
    realTime: "0",
    deadline: "",
    priority: "High" as Priority,
    queue: DEFAULT_QUEUE,
    completion: false,
    missed: false,
  };
}

function addDaysToDate(baseDate: Date, days: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper to scale all non-completed subtasks so their sum matches the remaining parent budget
function scaleIncompleteSubtasks(subtaskList: Task[], parentTotal: number): Task[] {
  if (subtaskList.length === 0) return [];

  const completedSum = subtaskList
    .filter((s) => s.completion)
    .reduce((sum, s) => sum + s.estimatedTime, 0);
  const remainingBudget = Math.max(0, Math.round((parentTotal - completedSum) * 100) / 100);

  const incomplete = subtaskList.filter((s) => !s.completion);
  if (incomplete.length === 0) return subtaskList;

  const prevSum = incomplete.reduce((sum, s) => sum + s.estimatedTime, 0);
  let allocated = 0;

  return subtaskList.map((s) => {
    if (s.completion) return s;
    const isLastIncomplete = s.id === incomplete[incomplete.length - 1].id;
    let est: number;
    if (isLastIncomplete) {
      est = Math.max(0, Math.round((remainingBudget - allocated) * 100) / 100);
    } else if (prevSum > 0) {
      est = Math.round((remainingBudget * (s.estimatedTime / prevSum)) * 100) / 100;
      allocated += est;
    } else {
      est = Math.round((remainingBudget / incomplete.length) * 100) / 100;
      allocated += est;
    }
    return { ...s, estimatedTime: est };
  });
}

export function TaskModal({
  open,
  mode,
  task,
  allTasks = [],
  existingQueues = [DEFAULT_QUEUE],
  onClose,
  onCreate,
  onCreateSubtasksBatch,
  onSaveEdit,
  onSaveTasksBatch,
  onDelete,
  onOpenTask,
  onTriggerComplete,
}: TaskModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(newEmptyForm);
  const [isCreatingNewQueue, setIsCreatingNewQueue] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [isWide, setIsWide] = useState(true);

  // Subtasks local state
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const subtasksRef = useRef<Task[]>([]);
  useEffect(() => {
    subtasksRef.current = subtasks;
  }, [subtasks]);

  const [showAutoCreate, setShowAutoCreate] = useState(false);
  const [autoDays, setAutoDays] = useState("1");
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const prevOpenRef = useRef(false);
  const prevTaskIdRef = useRef<string | null>(null);

  const availableQueues = useMemo(() => {
    const set = new Set<string>([DEFAULT_QUEUE, ...existingQueues]);
    if (task?.queue) set.add(task.queue);
    return Array.from(set).filter(Boolean);
  }, [existingQueues, task]);

  // Find parent task if current task is a subtask
  const parentTask = useMemo(() => {
    if (!task?.parentId) return null;
    return allTasks.find((t) => t.id === task.parentId) ?? null;
  }, [task, allTasks]);

  useEffect(() => {
    const checkWidth = () => {
      setIsWide(window.innerWidth > 768);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Sync subtasks from allTasks only on initial open or when switching tasks
  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      prevTaskIdRef.current = null;
      return;
    }

    const isNewlyOpened = !prevOpenRef.current;
    const isDifferentTask = task?.id !== prevTaskIdRef.current;

    if (isNewlyOpened || isDifferentTask) {
      prevOpenRef.current = true;
      prevTaskIdRef.current = task?.id ?? null;

      if (mode === "edit" && task) {
        setForm({
          name: task.name,
          description: task.description ?? "",
          estimatedTime: String(task.estimatedTime),
          realTime: String(task.realTime),
          deadline: task.deadline ?? "",
          priority: task.priority,
          queue: task.queue || DEFAULT_QUEUE,
          completion: task.completion,
          missed: task.missed,
        });

        // Filter subtasks belonging to this task
        const childTasks = allTasks
          .filter((t) => t.parentId === task.id)
          .sort((a, b) => (a.subtaskIndex ?? 0) - (b.subtaskIndex ?? 0));
        setSubtasks(childTasks);

        setIsCreatingNewQueue(false);
        setNewQueueName("");
        setEditingDesc(false);
        setShowAutoCreate(false);
        setIsAddingSubtask(false);
        setNewSubtaskName("");
      } else {
        setForm(newEmptyForm());
        setSubtasks([]);
        setIsCreatingNewQueue(false);
        setNewQueueName("");
        setEditingDesc(false);
        setShowAutoCreate(false);
        setIsAddingSubtask(false);
        setNewSubtaskName("");
      }
    }
  }, [open, mode, task, allTasks]);

  // Calculate default auto-create days when form deadline or estimated time changes
  useEffect(() => {
    const est = Number(form.estimatedTime) || 0;
    if (est <= 1) return;
    const daysUntilDl = form.deadline ? Math.max(1, getDaysUntilDue(form.deadline, new Date())) : null;
    const defaultDays = daysUntilDl != null ? Math.max(1, Math.min(Math.round(est), daysUntilDl)) : Math.max(1, Math.round(est));
    setAutoDays(String(defaultDays));
  }, [form.estimatedTime, form.deadline]);

  useEffect(() => {
    if (!open || mode !== "add") return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    el?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (editingDesc && descRef.current) {
      descRef.current.focus();
    }
  }, [editingDesc]);

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

  // Commit subtasks batch to database
  const handleCommitSubtasks = (listToSave?: Task[]) => {
    const list = listToSave ?? subtasksRef.current;
    if (mode === "edit" && onSaveTasksBatch && list.length > 0) {
      void onSaveTasksBatch(list);
    }
  };

  // When parent estimated time changes in the form, scale all non-completed subtasks proportionally
  const handleParentEstimatedTimeChange = (newEstStr: string) => {
    setForm((f) => ({ ...f, estimatedTime: newEstStr }));
    const newTotal = parseNum(newEstStr);
    if (subtasks.length === 0) return;

    const updatedSubtasks = scaleIncompleteSubtasks(subtasks, newTotal);
    setSubtasks(updatedSubtasks);
  };

  // Downstream readjustment: editing subtask estimated time only readjusts subsequent subtasks (index > current)
  const handleSubtaskEstimatedTimeChange = (subtaskIndexInArray: number, newEstVal: number) => {
    const parentTotal = parseNum(form.estimatedTime);
    const validNewEst = Math.max(0, Number.isFinite(newEstVal) ? newEstVal : 0);

    const updated = [...subtasks];
    updated[subtaskIndexInArray] = {
      ...updated[subtaskIndexInArray],
      estimatedTime: validNewEst,
    };

    // Subtasks with index > subtaskIndexInArray that are NOT completed
    const downstreamIncomplete = updated
      .slice(subtaskIndexInArray + 1)
      .filter((s) => !s.completion);

    if (downstreamIncomplete.length > 0) {
      // Sum of preceding subtasks + edited subtask + any completed subtasks
      const fixedSum =
        updated.slice(0, subtaskIndexInArray).reduce((sum, s) => sum + s.estimatedTime, 0) +
        validNewEst +
        updated.slice(subtaskIndexInArray + 1).filter((s) => s.completion).reduce((sum, s) => sum + s.estimatedTime, 0);

      const remainingBudget = Math.max(0, Math.round((parentTotal - fixedSum) * 100) / 100);
      const prevDownstreamSum = downstreamIncomplete.reduce((sum, s) => sum + s.estimatedTime, 0);

      let allocated = 0;
      for (let i = subtaskIndexInArray + 1; i < updated.length; i++) {
        if (updated[i].completion) continue;
        const isLastIncomplete = updated[i].id === downstreamIncomplete[downstreamIncomplete.length - 1].id;
        let est: number;
        if (isLastIncomplete) {
          est = Math.max(0, Math.round((remainingBudget - allocated) * 100) / 100);
        } else if (prevDownstreamSum > 0) {
          est = Math.round((remainingBudget * (updated[i].estimatedTime / prevDownstreamSum)) * 100) / 100;
          allocated += est;
        } else {
          est = Math.round((remainingBudget / downstreamIncomplete.length) * 100) / 100;
          allocated += est;
        }
        updated[i] = { ...updated[i], estimatedTime: est };
      }
    }

    setSubtasks(updated);
  };

  // Subtask name change (local state only; syncs on blur/enter)
  const handleSubtaskNameChange = (idx: number, name: string) => {
    const updated = [...subtasks];
    updated[idx] = { ...updated[idx], name };
    setSubtasks(updated);
  };

  // Subtask deadline change (local state only; syncs on blur/enter)
  const handleSubtaskDeadlineChange = (idx: number, deadlineStr: string) => {
    const updated = [...subtasks];
    const formatted = deadlineStr.trim() === "" ? null : deadlineStr;
    updated[idx] = { ...updated[idx], deadline: formatted };
    setSubtasks(updated);
  };

  // Drag and drop reordering - Auto reassign due dates based on new order
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragOverIdx !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const next = [...subtasks];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(targetIdx, 0, moved);

    // Auto-reassign due dates based on the new order:
    // Gather all existing non-null deadlines sorted chronologically
    const existingDeadlines = subtasks
      .map((s) => s.deadline)
      .filter((d): d is string => d !== null && d !== "")
      .sort();

    const today = new Date();
    const daysUntilDl = form.deadline ? Math.max(1, getDaysUntilDue(form.deadline, today)) : null;

    // Re-index all subtasks: 1, 2, 3... and reassign deadlines in chronological order
    const reindexed = next.map((s, i) => {
      let newDeadline = s.deadline;
      if (existingDeadlines.length === next.length) {
        newDeadline = existingDeadlines[i];
      } else if (daysUntilDl != null) {
        const offset = Math.max(1, Math.round((i + 1) * (daysUntilDl / next.length)));
        newDeadline = addDaysToDate(today, offset);
      }
      return {
        ...s,
        subtaskIndex: i + 1,
        deadline: newDeadline,
      };
    });

    setSubtasks(reindexed);
    setDraggedIdx(null);
    setDragOverIdx(null);

    handleCommitSubtasks(reindexed);
  };

  // Handle Delete Subtask (Auto scales remaining non-completed subtasks)
  const handleDeleteSubtask = async (subtaskId: string) => {
    const parentHours = parseNum(form.estimatedTime);
    const remaining = subtasks.filter((s) => s.id !== subtaskId);
    const scaled = scaleIncompleteSubtasks(remaining, parentHours).map((s, i) => ({
      ...s,
      subtaskIndex: i + 1,
    }));
    setSubtasks(scaled);

    if (mode === "edit") {
      if (onDelete) await onDelete(subtaskId);
      if (onSaveTasksBatch && scaled.length > 0) await onSaveTasksBatch(scaled);
    }
  };

  // Handle Auto Create Subtasks (Appends 'Subtask' without index in task name)
  const handleCreateAutoSubtasks = async () => {
    const daysCount = Math.max(1, parseInt(autoDays, 10) || 1);
    const parentHours = parseNum(form.estimatedTime);
    const finalQueue = isCreatingNewQueue
      ? newQueueName.trim() || DEFAULT_QUEUE
      : form.queue.trim() || DEFAULT_QUEUE;

    const baseHours = Math.round((parentHours / daysCount) * 100) / 100;
    let distributedHours = 0;

    const today = new Date();
    const daysUntilDl = form.deadline ? Math.max(1, getDaysUntilDue(form.deadline, today)) : null;
    const baseParentName = form.name.trim() || "Task";

    const newSubtaskInputs = Array.from({ length: daysCount }, (_, i) => {
      const idx = i + 1;
      const isLast = idx === daysCount;
      const est = isLast
        ? Math.max(0, Math.round((parentHours - distributedHours) * 100) / 100)
        : baseHours;
      distributedHours += est;

      // Evenly spaced deadline before final deadline
      let subtaskDeadline: string;
      if (daysUntilDl != null) {
        const offset = Math.max(1, Math.round(idx * (daysUntilDl / daysCount)));
        subtaskDeadline = addDaysToDate(today, offset);
      } else {
        subtaskDeadline = addDaysToDate(today, idx);
      }

      return {
        name: `${baseParentName} Subtask`,
        description: "",
        estimatedTime: est,
        deadline: subtaskDeadline,
        priority: form.priority,
        queue: finalQueue,
        parentId: task?.id || "",
        subtaskIndex: idx,
      };
    });

    const createdLocal: Task[] = newSubtaskInputs.map((input) => ({
      ...input,
      id: createTaskId(),
      realTime: 0,
      completion: false,
      missed: false,
      updatedAt: nowIso(),
    }));

    if (mode === "edit" && task && onCreateSubtasksBatch) {
      setSaving(true);
      try {
        const created = await onCreateSubtasksBatch(newSubtaskInputs);
        setSubtasks(created && created.length > 0 ? created : createdLocal);
        setShowAutoCreate(false);
      } finally {
        setSaving(false);
      }
    } else {
      // In add mode or local state
      setSubtasks(createdLocal);
      setShowAutoCreate(false);
    }
  };

  // Handle Manual Add Subtask (Auto scales non-completed subtasks)
  const handleAddSingleSubtask = async () => {
    if (!newSubtaskName.trim()) return;
    const finalQueue = isCreatingNewQueue
      ? newQueueName.trim() || DEFAULT_QUEUE
      : form.queue.trim() || DEFAULT_QUEUE;

    const parentHours = parseNum(form.estimatedTime);
    const nextIndex = subtasks.length + 1;

    const draftTask: Task = {
      id: createTaskId(),
      name: newSubtaskName.trim(),
      description: "",
      estimatedTime: 0,
      realTime: 0,
      deadline: form.deadline.trim() === "" ? null : form.deadline,
      priority: form.priority,
      queue: finalQueue,
      parentId: task?.id || null,
      subtaskIndex: nextIndex,
      completion: false,
      missed: false,
      updatedAt: nowIso(),
    };

    // Auto-scale all non-completed tasks (existing + new)
    const allWithNew = [...subtasks, draftTask];
    const scaledAll = scaleIncompleteSubtasks(allWithNew, parentHours).map((s, i) => ({
      ...s,
      subtaskIndex: i + 1,
    }));

    setSubtasks(scaledAll);
    setNewSubtaskName("");
    setIsAddingSubtask(false);

    if (mode === "edit" && task && onSaveTasksBatch) {
      setSaving(true);
      try {
        await onSaveTasksBatch(scaledAll);
      } finally {
        setSaving(false);
      }
    }
  };

  const renderDescription = (text: string) => {
    if (!text.trim()) return <span className="muted">Click to add description...</span>;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const finalQueue = isCreatingNewQueue
      ? newQueueName.trim() || DEFAULT_QUEUE
      : form.queue.trim() || DEFAULT_QUEUE;

    try {
      if (mode === "add") {
        await onCreate({
          name: form.name,
          description: form.description.trim(),
          estimatedTime: parseNum(form.estimatedTime),
          deadline: form.deadline.trim() === "" ? null : form.deadline,
          priority: form.priority,
          queue: finalQueue,
          parentId: task?.parentId ?? null,
          subtaskIndex: task?.subtaskIndex ?? null,
        });
      } else if (task) {
        const completion = form.completion;
        const missed =
          form.completion && form.missed ? false : form.missed;
        await onSaveEdit({
          ...task,
          name: form.name.trim() || "Untitled",
          description: form.description.trim() || undefined,
          estimatedTime: parseNum(form.estimatedTime),
          realTime: parseNum(form.realTime),
          deadline: form.deadline.trim() === "" ? null : form.deadline,
          priority: form.priority,
          queue: finalQueue,
          completion,
          missed,
        });
        if (onSaveTasksBatch && subtasks.length > 0) {
          await onSaveTasksBatch(subtasks);
        }
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

  const estNum = parseNum(form.estimatedTime);
  const autoDaysNum = Math.max(1, parseInt(autoDays, 10) || 1);
  const hoursPerDayDisplay = (estNum / autoDaysNum).toFixed(1);

  // Subtasks section JSX (reused in wide and narrow layouts)
  const subtasksSection = (
    <div className="subtasks-container" style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
          Subtasks ({subtasks.length})
        </span>

        {estNum > 1 && !showAutoCreate && (
          <button
            type="button"
            className="btn btn-sm secondary"
            onClick={() => setShowAutoCreate(true)}
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
          >
            ⚡ Auto create subtasks
          </button>
        )}
      </div>

      {showAutoCreate && (
        <div className="subtask-auto-create-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1e293b" }}>
              Auto-divide into daily subtasks
            </span>
            <button
              type="button"
              className="btn-close-subtask"
              onClick={() => setShowAutoCreate(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", flex: 1 }}>
              <span>Days:</span>
              <input
                type="number"
                min={1}
                value={autoDays}
                onChange={(e) => setAutoDays(e.target.value)}
                style={{ width: "4.5rem", padding: "0.25rem 0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <div
              style={{
                fontSize: "0.8rem",
                padding: "0.25rem 0.5rem",
                background: "#f1f5f9",
                borderRadius: "4px",
                color: "#334155",
                whiteSpace: "nowrap",
              }}
              title="Calculated hours per day"
            >
              <strong>{hoursPerDayDisplay}</strong> h/day
            </div>

            <button
              type="button"
              className="btn btn-sm primary"
              onClick={() => void handleCreateAutoSubtasks()}
              disabled={saving}
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Subtask list */}
      <div className="subtask-list">
        {subtasks.length === 0 && !showAutoCreate && (
          <p className="muted" style={{ fontSize: "0.8rem", margin: "0.25rem 0 0.5rem" }}>
            No subtasks yet. Add one below.
          </p>
        )}

        {subtasks.map((s, idx) => (
          <div
            key={s.id || `local-${idx}`}
            className={`subtask-item-row ${dragOverIdx === idx ? "subtask-drag-over" : ""}`}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
          >
            {/* Drag handle */}
            <span
              className="subtask-drag-handle"
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              title="Drag to reorder subtask"
            >
              ⠿
            </span>

            {/* Checkbox */}
            <input
              type="checkbox"
              checked={s.completion}
              aria-label={`Mark ${s.name} complete`}
              onChange={(e) => {
                if (e.target.checked && onTriggerComplete) {
                  onTriggerComplete(s);
                } else if (!e.target.checked && onSaveTasksBatch) {
                  const next = [...subtasks];
                  next[idx] = { ...next[idx], completion: false };
                  setSubtasks(next);
                  void onSaveTasksBatch(next);
                }
              }}
              style={{ width: "auto", cursor: "pointer" }}
            />

            {/* Subtask name */}
            <input
              type="text"
              value={s.name}
              onChange={(e) => handleSubtaskNameChange(idx, e.target.value)}
              onBlur={() => handleCommitSubtasks()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="subtask-name-input"
              placeholder="Subtask name"
              title={s.name}
            />

            {/* Subtask due date */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="date"
                value={s.deadline ?? ""}
                onChange={(e) => handleSubtaskDeadlineChange(idx, e.target.value)}
                onBlur={() => handleCommitSubtasks()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
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
                className="subtask-date-input"
                title={s.deadline ? `Due date: ${s.deadline}` : "Set subtask due date"}
              />
            </div>

            {/* Estimated time */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <input
                type="number"
                step="any"
                min={0}
                value={s.estimatedTime}
                onChange={(e) => handleSubtaskEstimatedTimeChange(idx, parseNum(e.target.value))}
                onBlur={() => handleCommitSubtasks()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="subtask-hours-input"
                title="Subtask estimated hours"
              />
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>h</span>
            </div>

            {/* Delete subtask */}
            <button
              type="button"
              className="btn-subtask-action"
              onClick={() => void handleDeleteSubtask(s.id)}
              title="Delete subtask"
            >
              ✕
            </button>

            {/* Jump to subtask modal arrow */}
            {onOpenTask && (
              <button
                type="button"
                className="btn-subtask-action btn-subtask-jump"
                onClick={() => onOpenTask(s)}
                title="Open subtask in modal"
              >
                →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Inline add subtask button / input */}
      {isAddingSubtask ? (
        <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem" }}>
          <input
            type="text"
            placeholder="Subtask name..."
            value={newSubtaskName}
            autoFocus
            onChange={(e) => setNewSubtaskName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAddSingleSubtask();
              } else if (e.key === "Escape") {
                setIsAddingSubtask(false);
              }
            }}
            style={{ flex: 1, padding: "0.3rem 0.5rem", fontSize: "0.85rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
          />
          <button
            type="button"
            className="btn btn-sm primary"
            onClick={() => void handleAddSingleSubtask()}
            style={{ padding: "0.3rem 0.6rem" }}
          >
            Add
          </button>
          <button
            type="button"
            className="btn btn-sm secondary"
            onClick={() => setIsAddingSubtask(false)}
            style={{ padding: "0.3rem 0.6rem" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-sm secondary"
          onClick={() => setIsAddingSubtask(true)}
          style={{ marginTop: "0.4rem", width: "100%", fontSize: "0.8rem", borderStyle: "dashed" }}
        >
          + Add subtask
        </button>
      )}

      {/* Button below subtask list that allows jumping to parent task, if it exists */}
      {task?.parentId && (
        <div style={{ marginTop: "0.85rem", paddingTop: "0.65rem", borderTop: "1px solid #e2e8f0" }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => parentTask && onOpenTask?.(parentTask)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
              fontSize: "0.85rem",
              color: "#2563eb",
            }}
          >
            <span>←</span> Go to parent task{parentTask ? `: “${parentTask.name}”` : ""}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="modal-overlay"
      onMouseDown={overlayMouseDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="modal-flex-layout"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          gap: isWide ? "1rem" : 0,
          alignItems: "stretch",
          justifyContent: "center",
          flexWrap: "wrap",
          width: "100%",
          maxWidth: isWide ? "1000px" : "500px",
          padding: "1rem",
          boxSizing: "border-box",
        }}
      >
        <div className="modal-panel" style={{ flex: "1 1 300px", maxWidth: "100%" }}>
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
              <span>Queue</span>
              <select
                value={isCreatingNewQueue ? "__new__" : form.queue}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setIsCreatingNewQueue(true);
                  } else {
                    setIsCreatingNewQueue(false);
                    setForm((f) => ({ ...f, queue: e.target.value }));
                  }
                }}
              >
                {availableQueues.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
                <option value="__new__">+ Create new queue...</option>
              </select>
            </label>
            {isCreatingNewQueue && (
              <label className="field">
                <span>New queue name</span>
                <input
                  type="text"
                  placeholder="e.g. ECE391, Solar Car, Autonomy"
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  required
                />
              </label>
            )}
            {!isWide && (
              <label className="field">
                <span>Description</span>
                {editingDesc ? (
                  <textarea
                    ref={descRef}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    onBlur={() => setEditingDesc(false)}
                    rows={3}
                  />
                ) : (
                  <div
                    className="description-view"
                    onClick={() => setEditingDesc(true)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditingDesc(true);
                      }
                    }}
                  >{renderDescription(form.description)}</div>
                )}
              </label>
            )}
            <label className="field">
              <span>Estimated time (hours)</span>
              <input
                type="number"
                step="any"
                min={0}
                value={form.estimatedTime}
                onChange={(e) => handleParentEstimatedTimeChange(e.target.value)}
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
                    onChange={(e) => {
                      if (e.target.checked && task && onTriggerComplete) {
                        onTriggerComplete(task);
                      } else {
                        setForm((f) => ({
                          ...f,
                          completion: e.target.checked,
                          missed: e.target.checked ? false : f.missed,
                        }));
                      }
                    }}
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

            {/* In narrow layout, subtasks render below description/fields */}
            {!isWide && subtasksSection}

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

        {isWide && (
          <div
            className="modal-panel"
            style={{ flex: "1 1 340px", display: "flex", flexDirection: "column" }}
          >
            <h2 className="modal-title">Description</h2>
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100px" }} className="field">
              {editingDesc ? (
                <textarea
                  ref={descRef}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  onBlur={() => setEditingDesc(false)}
                  style={{ flex: 1, resize: "none", minHeight: "100px", boxSizing: "border-box", width: "100%" }}
                />
              ) : (
                <div
                  className="description-view"
                  onClick={() => setEditingDesc(true)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingDesc(true);
                    }
                  }}
                  style={{ flex: 1, overflowY: "auto", minHeight: "100px" }}
                >
                  {renderDescription(form.description)}
                </div>
              )}
            </div>

            {/* In wide layout, Subtasks are located on right window below description */}
            {subtasksSection}
          </div>
        )}
      </div>
    </div>
  );
}
