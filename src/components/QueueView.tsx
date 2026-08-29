import { useMemo } from "react";
import type { Task } from "@/types/task";
import { isOverdue } from "@/types/task";
import { groupAndSortQueues, getDaysUntilDue } from "@/lib/queueUtils";
import "./QueueView.css";

type Props = {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
  onCompletionChange: (id: string, checked: boolean) => void;
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

export function QueueView({ tasks, onOpenTask, onCompletionChange }: Props) {
  const today = useMemo(() => new Date(), []);
  const queues = useMemo(() => groupAndSortQueues(tasks, today), [tasks, today]);

  return (
    <div className="queue-view-container">
      {queues.length === 0 ? (
        <p className="muted">No active queues found. Add a task to get started.</p>
      ) : (
        queues.map((group) => {
          const logScore = group.score > 0 ? (Math.log10(group.score + 1)).toFixed(1) : "0.0";

          return (
            <div key={group.name} className="queue-row-section">
              <div className="queue-row-header">
                <div className="queue-title-wrap">
                  <h2 className="queue-name">{group.name}</h2>
                  <span className="queue-badge count-badge">
                    {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <span
                  className="queue-badge score-badge"
                  title={`Raw urgency score: ${Math.round(group.score * 10) / 10} (log10 scaled)`}
                >
                  Score: {logScore}
                </span>
              </div>

              <div className="queue-cards-scroll">
                {group.tasks.length === 0 ? (
                  <div className="queue-empty-card">No active tasks in this queue</div>
                ) : (
                  group.tasks.map((task) => {
                    const overdue = isOverdue(task, today);
                    const dlInfo = formatDeadlineText(task, today);

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
                          <span className="queue-task-title">
                            {task.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={task.completion}
                            aria-label={`Mark ${task.name} complete`}
                            className="queue-card-checkbox"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              onCompletionChange(task.id, e.target.checked);
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
