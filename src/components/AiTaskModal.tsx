import React, { useState, useEffect, useRef } from "react";
import type { Task } from "@/types/task";
import { toLocalDateString } from "@/types/task";
import { TaskModal } from "./TaskModal";

export type AiTaskModalProps = {
  open: boolean;
  onClose: () => void;
  onSaveTasks: (tasks: Omit<Task, "id" | "realTime" | "completion" | "missed" | "updatedAt">[]) => Promise<void>;
};

export function AiTaskModal({ open, onClose, onSaveTasks }: AiTaskModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftTasks, setDraftTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if API Key is configured in environment
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    if (!open) return;
    if (!apiKey) {
      setError(
        "Gemini API key is not configured. Please define the VITE_GEMINI_API_KEY variable in your .env file to enable this feature."
      );
    } else {
      setError(null);
    }
    setPrompt("");
    setDraftTasks([]);
    setLoading(false);
  }, [open, apiKey]);

  useEffect(() => {
    if (open && !loading && !draftTasks.length && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, loading, draftTasks]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingTask) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, editingTask]);

  if (!open) return null;

  const overlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !editingTask) onClose();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return;
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    const today = new Date();
    const todayStr = toLocalDateString(today);
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = daysOfWeek[today.getDay()];

    const systemInstruction = `You are an AI assistant parsing the user's natural language input into a list of tasks.
Today's local date is ${todayStr} (${dayOfWeek}).

Parse the input and return a JSON object containing a list of tasks.
For each task:
- name: (string, required) Short, clear name of the task.
- description: (string, optional) Details or description of the task.
- estimatedTime: (number, optional) Estimated hours. Default to 0 if unknown.
- deadline: (string, optional) Deadline in YYYY-MM-DD format. Calculate relative dates like 'tomorrow', 'next week', 'Friday', 'next Monday' using today's date ${todayStr}. If no deadline is specified or implied, use null.
- priority: (string, required) Must be one of: "High", "Medium", "Low". Default is "Medium".

You must respond with raw JSON matching the following structure:
{
  "tasks": [
    {
      "name": "task name",
      "description": "task description",
      "estimatedTime": 2,
      "deadline": "YYYY-MM-DD",
      "priority": "Medium"
    }
  ]
}
Do not write any markdown code blocks or explanations in your response. Return raw JSON text only.`;

    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
    let lastError: Error | null = null;
    let text = "";

    try {
      for (const model of modelsToTry) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: systemInstruction },
                      { text: `User Prompt: ${prompt}` },
                    ],
                  },
                ],
              }),
            }
          );

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error("API Rate limit or tokens exhausted (free limits reached). Please try again in a minute.");
            }
            const errJson = await response.json().catch(() => null);
            throw new Error(errJson?.error?.message || `API request failed with status ${response.status}`);
          }

          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!generatedText) {
            throw new Error("No response generated.");
          }

          text = generatedText;
          break; // Success!
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (!text) {
        throw lastError || new Error("All attempts to query Gemini models failed.");
      }

      interface GeminiTask {
        name: string;
        description?: string;
        estimatedTime?: number;
        deadline?: string | null;
        priority?: string;
      }

      let cleanText = text.trim();
      if (cleanText.startsWith("```")) {
        // Remove starting ```json or ```
        cleanText = cleanText.replace(/^```(?:json)?\n?/i, "");
        // Remove ending ```
        cleanText = cleanText.replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleanText.trim());
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error("Failed to parse valid tasks list from Gemini response.");
      }

      const resolvedTasks: Task[] = (parsed.tasks as GeminiTask[]).map((t) => ({
        id: crypto.randomUUID(),
        name: t.name || "Untitled Task",
        description: t.description || "",
        estimatedTime: typeof t.estimatedTime === "number" ? t.estimatedTime : 0,
        realTime: 0,
        deadline: t.deadline || null,
        priority: (t.priority === "High" || t.priority === "Medium" || t.priority === "Low") ? t.priority : "Medium",
        completion: false,
        missed: false,
        updatedAt: new Date().toISOString(),
      }));

      if (resolvedTasks.length === 0) {
        setError("Gemini did not identify any tasks in your prompt. Try adding more details.");
      } else {
        setDraftTasks(resolvedTasks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tasksToCreate = draftTasks.map((t) => ({
        name: t.name,
        description: t.description,
        estimatedTime: t.estimatedTime,
        deadline: t.deadline,
        priority: t.priority,
      }));
      await onSaveTasks(tasksToCreate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditRow = (task: Task) => {
    setEditingTask(task);
  };

  const handleSaveDraftEdit = async (updatedTask: Task) => {
    setDraftTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setEditingTask(null);
  };

  const handleDeleteDraft = async (id: string) => {
    setDraftTasks((prev) => prev.filter((t) => t.id !== id));
    setEditingTask(null);
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={overlayMouseDown}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="modal-panel ai-modal-panel"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 750px)",
          maxWidth: "100%",
          borderRadius: "16px",
          background: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="modal-title" style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, background: "linear-gradient(135deg, #4f46e5, #9333ea)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ✨ Add Tasks with AI
          </h2>
          <button
            type="button"
            className="btn secondary btn-sm"
            onClick={onClose}
            style={{ borderRadius: "50%", width: "2rem", height: "2rem", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="banner error" role="alert" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1rem", gap: "1rem" }}>
            <div className="ai-loading-spinner" />
            <p className="muted" style={{ fontWeight: 500, margin: 0, animation: "ai-pulse 1.5s infinite" }}>
              Gemini is working its magic...
            </p>
          </div>
        ) : draftTasks.length === 0 ? (
          <form className="modal-form" onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label className="field" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#374151" }}>Describe the task(s) you want to create in natural language:</span>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Design a flyer by Friday priority High, call the plumber tomorrow, and prepare meeting notes (2 hours)"
                required
                disabled={!apiKey}
                rows={5}
                style={{
                  width: "100%",
                  borderRadius: "10px",
                  borderColor: "#d1d5db",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  resize: "vertical",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)"
                }}
              />
            </label>

            <div className="modal-actions" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn secondary" onClick={onClose} style={{ minWidth: "80px" }}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={!apiKey || !prompt.trim()}
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #9333ea)",
                  border: "none",
                  fontWeight: 600,
                  boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
                  minWidth: "120px"
                }}
              >
                Generate Tasks
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "#374151" }}>
                Review generated tasks ({draftTasks.length}):
              </span>
              <button
                type="button"
                className="btn linkish"
                onClick={() => setDraftTasks([])}
                style={{ fontSize: "0.85rem", padding: "0.25rem" }}
              >
                ← Back to prompt
              </button>
            </div>

            <div className="table-wrap" style={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
              <table className="task-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th scope="col" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "0.8rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>Task Name</th>
                    <th scope="col" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "0.8rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>Est. (h)</th>
                    <th scope="col" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "0.8rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>Deadline</th>
                    <th scope="col" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "0.8rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {draftTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => handleEditRow(task)}
                      className="ai-draft-row"
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", fontWeight: 500, color: "#111827" }}>
                        <span className="task-name-btn" style={{ fontWeight: 600 }}>{task.name}</span>
                        {task.description && (
                          <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginTop: "0.15rem", fontWeight: 400 }}>
                            {task.description}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", color: "#4b5563" }}>
                        {task.estimatedTime}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb", color: "#4b5563" }}>
                        {task.deadline || "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
                        <span className={`priority-pill priority-${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDraftTasks([])}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={saving}
                onClick={handleSave}
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  border: "none",
                  fontWeight: 600,
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.25)",
                  minWidth: "120px"
                }}
              >
                {saving ? "Saving..." : "Save Tasks"}
              </button>
            </div>
          </div>
        )}
      </div>

      {editingTask && (
        <TaskModal
          open={true}
          mode="edit"
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onCreate={async () => { }}
          onSaveEdit={handleSaveDraftEdit}
          onDelete={handleDeleteDraft}
        />
      )}
    </div>
  );
}
