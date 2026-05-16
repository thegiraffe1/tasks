import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/types/task";
import type { Availability } from "@/types/availability";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useTasks } from "@/hooks/useTasks";
import { useAvailabilities } from "@/hooks/useAvailabilities";
import { useAllocations } from "@/hooks/useAllocations";
import { TaskTable } from "@/components/TaskTable";
import { TaskModal } from "@/components/TaskModal";
import { AvailabilityTable } from "@/components/AvailabilityTable";
import { AvailabilityModal } from "@/components/AvailabilityModal";
import { CalendarView } from "@/components/CalendarView";
import { UndoBanner } from "@/components/UndoBanner";

type UndoKind = "done" | "missed";

type UndoEntry = {
  snapshot: Task;
  kind: UndoKind;
};

export default function App() {
  const {
    sortedTasks,
    loading: tasksLoading,
    error: tasksError,
    addTask,
    updateTask,
    replaceTask,
    removeTask,
  } = useTasks();

  const {
    availabilities,
    loading: availLoading,
    error: availError,
    addAvailability,
    updateAvailability,
    replaceAvailability,
    removeAvailability,
  } = useAvailabilities();

  const { tasksByDate } = useAllocations();

  const [activeTab, setActiveTab] = useState<"tasks" | "availability" | "calendar">("tasks");

  // Task modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<"add" | "edit">("add");
  const [modalTask, setModalTask] = useState<Task | null>(null);

  // Availability modal state
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [availModalMode, setAvailModalMode] = useState<"add" | "edit">("add");
  const [modalAvail, setModalAvail] = useState<Availability | null>(null);

  const undoStackRef = useRef<UndoEntry[]>([]);

  const [undoUi, setUndoUi] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const usingSupabase = isSupabaseConfigured();

  const dismissUndo = useCallback(() => {
    undoStackRef.current = [];
    setUndoUi({ open: false, message: "" });
  }, []);

  const pushUndo = useCallback(
    (snapshot: Task, kind: UndoKind, message: string) => {
      undoStackRef.current.push({
        snapshot: structuredClone(snapshot),
        kind,
      });
      setUndoUi({ open: true, message });
    },
    [],
  );

  const undoLast = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      setUndoUi({ open: false, message: "" });
      return;
    }
    await replaceTask(entry.snapshot);
    if (undoStackRef.current.length === 0) {
      setUndoUi({ open: false, message: "" });
    }
  }, [replaceTask]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement;
      if (t.closest("textarea, select, [contenteditable]")) return;
      const input = t.closest("input");
      if (
        input &&
        input.type !== "checkbox" &&
        input.type !== "radio" &&
        input.type !== "hidden"
      ) {
        return;
      }
      if (undoStackRef.current.length === 0) return;
      e.preventDefault();
      void undoLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLast]);

  useEffect(() => {
    if (!undoUi.open) return;
    let pops = 0;
    while (undoStackRef.current.length > 0) {
      const top = undoStackRef.current[undoStackRef.current.length - 1];
      const t = sortedTasks.find((x) => x.id === top.snapshot.id);
      const invalidate =
        !t ||
        (top.kind === "done" && !t.completion) ||
        (top.kind === "missed" && !t.missed);
      if (!invalidate) break;
      undoStackRef.current.pop();
      pops++;
    }
    if (pops === 0) return;
    if (undoStackRef.current.length === 0) {
      setUndoUi({ open: false, message: "" });
    } else {
      const newTop = undoStackRef.current.at(-1);
      setUndoUi({
        open: true,
        message:
          newTop?.kind === "done"
            ? "Marked as done."
            : "Marked as missed.",
      });
    }
  }, [sortedTasks, undoUi.open]);

  const openTaskAdd = () => {
    setTaskModalMode("add");
    setModalTask(null);
    setTaskModalOpen(true);
  };

  const openTaskEdit = (task: Task) => {
    setTaskModalMode("edit");
    setModalTask(task);
    setTaskModalOpen(true);
  };

  const openAvailAdd = () => {
    setAvailModalMode("add");
    setModalAvail(null);
    setAvailModalOpen(true);
  };

  const openAvailEdit = (availability: Availability) => {
    setAvailModalMode("edit");
    setModalAvail(availability);
    setAvailModalOpen(true);
  };

  const handleCompletionChange = async (id: string, checked: boolean) => {
    const prev = sortedTasks.find((t) => t.id === id);
    await updateTask(id, { completion: checked });
    if (prev && checked && !prev.completion) {
      pushUndo(prev, "done", "Marked as done.");
    }
  };

  const handleMissedChange = async (id: string, checked: boolean) => {
    const prev = sortedTasks.find((t) => t.id === id);
    await updateTask(id, { missed: checked });
    if (prev && checked && !prev.missed) {
      pushUndo(prev, "missed", "Marked as missed.");
    }
  };

  const handleSaveTaskEdit = async (task: Task) => {
    const prev = sortedTasks.find((t) => t.id === task.id);
    await replaceTask(task);
    if (prev) {
      const becameDone = !prev.completion && task.completion;
      const becameMissed = !prev.missed && task.missed;
      if (becameDone) pushUndo(prev, "done", "Marked as done.");
      else if (becameMissed) pushUndo(prev, "missed", "Marked as missed.");
    }
  };

  const handleSaveAvailEdit = async (availability: Availability) => {
    await replaceAvailability(availability);
  };

  const onAddClick = () => {
    if (activeTab === "tasks") {
      openTaskAdd();
    } else if (activeTab === "availability") {
      openAvailAdd();
    }
  };

  return (
    <div className={undoUi.open ? "app app--undo" : "app"}>
      <header className="header">
        <div>
          <h1 className="title">Task Tracker</h1>
          <p className="subtitle">
            {usingSupabase
              ? "Storage: Supabase"
              : "Storage: browser (localStorage). Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use Supabase."}
          </p>
        </div>
        {activeTab !== "calendar" && (
          <button
            type="button"
            className="btn primary add-task-btn"
            onClick={onAddClick}
            aria-label={activeTab === "tasks" ? "Add task" : "Add availability"}
          >
            <span className="add-task-label">
              {activeTab === "tasks" ? "Add task" : "Add availability"}
            </span>
            <span className="add-task-plus" aria-hidden="true">
              +
            </span>
          </button>
        )}
      </header>

      <nav className="nav-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem' }}>
        <button
          style={{ fontWeight: activeTab === 'tasks' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          style={{ fontWeight: activeTab === 'availability' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          onClick={() => setActiveTab('availability')}
        >
          Availability
        </button>
        <button
          style={{ fontWeight: activeTab === 'calendar' ? 'bold' : 'normal', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar
        </button>
      </nav>

      {(tasksError || availError) ? (
        <div className="banner error" role="alert">
          {tasksError || availError}
        </div>
      ) : null}

      {activeTab === "tasks" && (
        <>
          {tasksLoading ? (
            <p className="muted">Loading tasks…</p>
          ) : (
            <>
              {sortedTasks.length === 0 ? (
                <p className="muted">No tasks yet. Add one to get started.</p>
              ) : null}
              <TaskTable
                tasks={sortedTasks}
                onOpenTask={openTaskEdit}
                onUpdateField={(id, patch) => void updateTask(id, patch)}
                onCompletionChange={(id, checked) =>
                  void handleCompletionChange(id, checked)
                }
                onMissedChange={(id, checked) =>
                  void handleMissedChange(id, checked)
                }
              />
            </>
          )}
        </>
      )}

      {activeTab === "availability" && (
        <>
          {availLoading ? (
            <p className="muted">Loading availability…</p>
          ) : (
            <>
              {availabilities.length === 0 ? (
                <p className="muted">No availabilities yet. Add one to get started.</p>
              ) : null}
              <AvailabilityTable
                availabilities={availabilities}
                tasksByDate={tasksByDate}
                onOpenAvailability={openAvailEdit}
                onUpdateField={(id, patch) => void updateAvailability(id, patch)}
              />
            </>
          )}
        </>
      )}

      {activeTab === "calendar" && (
        <CalendarView 
          tasks={sortedTasks}
          availabilities={availabilities}
        />
      )}

      <TaskModal
        open={taskModalOpen}
        mode={taskModalMode}
        task={modalTask}
        onClose={() => setTaskModalOpen(false)}
        onCreate={async (input) => {
          await addTask(input);
        }}
        onSaveEdit={handleSaveTaskEdit}
        onDelete={taskModalMode === "edit" ? removeTask : undefined}
      />

      <AvailabilityModal
        open={availModalOpen}
        mode={availModalMode}
        availability={modalAvail}
        onClose={() => setAvailModalOpen(false)}
        onCreate={async (input) => {
          await addAvailability(input);
        }}
        onSaveEdit={handleSaveAvailEdit}
        onDelete={availModalMode === "edit" ? removeAvailability : undefined}
      />

      <UndoBanner
        open={undoUi.open}
        message={undoUi.message}
        onUndo={() => void undoLast()}
        onDismiss={dismissUndo}
      />
    </div>
  );
}
