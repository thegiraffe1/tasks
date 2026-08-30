import { useMemo } from "react";
import type { Task } from "@/types/task";
import { isOverdue } from "@/types/task";
import { groupAndSortQueues, getDaysUntilDue, type QueueGroup } from "@/lib/queueUtils";
import "./QueueView.css";

type Props = {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onCompletionChange: (id: string, checked: boolean) => void;
  onTriggerComplete?: (task: Task) => void;
};

function priorityClass(priority: string): string {
  switch (priority) {
    case "High":
      return "priority-pill priority-high";
    case "Medium":
      return "priority-pill priority-medium";
    case "Low":
      return "priority-pill priority-low";
    default:
      return "priority-pill";
  }
}

function formatDeadlineText(task: Task, today: Date): { text: string; overdue: boolean } {
  if (!task.deadline) return { text: "No deadline", overdue: false };

  const days = getDaysUntilDue(task.deadline, today);
  if (days < 0) {
    const absDays = Math.abs(days);
    return {
      text: `${absDays}d past due`,
      overdue: true,
    };
  } else if (days === 0) {
    return { text: "Due today", overdue: false };
  } else if (days === 1) {
    return { text: "Due tomorrow", overdue: false };
  } else {
    return { text: `Due in ${days}d`, overdue: false };
  }
}

function getQueueTierBadge(group: QueueGroup): { label: string; className: string; title: string } {
  switch (group.tier) {
    case "overdue": {
      const days = group.urgencyDays != null ? Math.abs(group.urgencyDays) : 1;
      return {
        label: `⚠️ Past Due (${days}d)`,
        className: "queue-badge tier-badge-overdue",
        title: `Most urgent task is overdue by ${days} day(s) (${group.mostUrgentDeadline})`,
      };
    }
    case "today":
      return {
        label: "📅 Due Today",
        className: "queue-badge tier-badge-today",
        title: `Most urgent task is due today (${group.mostUrgentDeadline})`,
      };
    case "upcoming": {
      const days = group.urgencyDays ?? 0;
      const text = days === 1 ? "Due Tomorrow" : `Due in ${days}d`;
      return {
        label: `⏳ ${text}`,
        className: "queue-badge tier-badge-upcoming",
        title: `Earliest upcoming deadline is ${group.mostUrgentDeadline} (in ${days} days)`,
      };
    }
    case "no-deadline":
      return {
        label: "📋 No Deadline",
        className: "queue-badge tier-badge-neutral",
        title: "All active tasks in this queue have no deadline specified",
      };
    case "empty":
    default:
      return {
        label: "✓ All Done",
        className: "queue-badge tier-badge-empty",
        title: "No active tasks in this queue",
      };
  }
}

export function QueueView({ tasks, onOpenTask, onCompletionChange, onTriggerComplete }: Props) {
  const today = useMemo(() => new Date(), []);
  const queues = useMemo(() => groupAndSortQueues(tasks, today), [tasks, today]);

  // Build lookup maps for subtasks info and parent tasks
  const { subtaskStats } = useMemo(() => {
    const map = new Map<string, Task>();
    const childrenByParent = new Map<string, Task[]>();

    for (const t of tasks) {
      map.set(t.id, t);
      if (t.parentId) {
        const list = childrenByParent.get(t.parentId) || [];
        list.push(t);
        childrenByParent.set(t.parentId, list);
      }
    }

    const stats = new Map<string, { index: number; total: number; parent: Task | null }>();

    for (const [parentId, children] of childrenByParent.entries()) {
      children.sort((a, b) => (a.subtaskIndex ?? 0) - (b.subtaskIndex ?? 0));
      const total = children.length;
      const parent = map.get(parentId) ?? null;
      children.forEach((c, idx) => {
        const displayIndex = c.subtaskIndex != null && c.subtaskIndex > 0 ? c.subtaskIndex : idx + 1;
        stats.set(c.id, { index: displayIndex, total, parent });
      });
    }

    return { subtaskStats: stats };
  }, [tasks]);

  return (
    <div className="queue-view-container">
      {queues.length === 0 ? (
        <p className="muted">No active queues found. Add a task to get started.</p>
      ) : (
        queues.map((group) => {
          const tierBadge = getQueueTierBadge(group);

          return (
            <div key={group.name} className="queue-row-section">
              <div className="queue-row-header">
                <div className="queue-title-wrap">
                  <h2 className="queue-name">{group.name}</h2>
                  <span className="queue-badge count-badge">
                    {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
                  </span>
                  {group.totalActiveHours > 0 && (
                    <span className="queue-badge hours-badge" title="Total active hours in queue">
                      ⏱️ {group.totalActiveHours}h
                    </span>
                  )}
                </div>

                <div className="queue-header-badges">
                  {group.highestPriorityOnUrgentDate && (
                    <span
                      className={`queue-badge priority-indicator-badge ${priorityClass(group.highestPriorityOnUrgentDate)}`}
                      title={`Highest priority task on urgent date: ${group.highestPriorityOnUrgentDate} (${group.priorityHoursOnUrgentDate[group.highestPriorityOnUrgentDate]}h)`}
                    >
                      Top: {group.highestPriorityOnUrgentDate}
                    </span>
                  )}
                  <span className={tierBadge.className} title={tierBadge.title}>
                    {tierBadge.label}
                  </span>
                </div>
              </div>

              <div className="queue-cards-scroll">
                {group.tasks.length === 0 ? (
                  <div className="queue-empty-card">No active tasks in this queue</div>
                ) : (
                  group.tasks.map((task) => {
                    const overdue = isOverdue(task, today);
                    const dlInfo = formatDeadlineText(task, today);
                    const stStat = subtaskStats.get(task.id);

                    return (
                      <div
                        key={task.id}
                        className={`queue-task-card ${overdue ? "queue-card-overdue" : ""}`}
                        onClick={() => onOpenTask(task)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenTask(task);
                          }
                        }}
                        title="Click to view/edit task details"
                      >
                        <div className="queue-card-header">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", overflow: "hidden" }}>
                            <span className="queue-task-title">
                              {task.name}
                            </span>
                            {stStat && stStat.parent && (
                              <button
                                type="button"
                                className="subtask-badge-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (stStat.parent) onOpenTask(stStat.parent);
                                }}
                                title={`Part ${stStat.index} of ${stStat.total} — Click to view parent task: “${stStat.parent.name}”`}
                              >
                                {stStat.index}/{stStat.total}
                              </button>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={task.completion}
                            aria-label={`Mark ${task.name} complete`}
                            className="queue-card-checkbox"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.checked && onTriggerComplete) {
                                onTriggerComplete(task);
                              } else {
                                onCompletionChange(task.id, e.target.checked);
                              }
                              e.currentTarget.blur();
                            }}
                          />
                        </div>

                        {task.description && (
                          <p className="queue-card-desc" title={task.description}>
                            {task.description}
                          </p>
                        )}

                        <div className="queue-card-footer">
                          <span className={priorityClass(task.priority)}>{task.priority}</span>
                          <div className="queue-card-metrics">
                            <span className="queue-metric-pill" title="Estimated hours">
                              ⏱️ {task.estimatedTime}h
                            </span>
                            <span
                              className={`queue-metric-pill ${dlInfo.overdue ? "past-due-pill" : ""}`}
                              title={task.deadline ? `Deadline: ${task.deadline}` : "No deadline"}
                            >
                              📅 {dlInfo.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
