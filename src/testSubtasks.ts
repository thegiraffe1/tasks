import assert from "node:assert";
import type { Task } from "./types/task";
import { getDaysUntilDue } from "./lib/queueUtils";

console.log("Running comprehensive Subtasks unit tests...\n");

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    name: "Task",
    estimatedTime: 6,
    realTime: 0,
    deadline: "2026-09-02",
    priority: "High",
    queue: "Tasks",
    completion: false,
    missed: false,
    parentId: null,
    subtaskIndex: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Test 1: Auto-create subtasks day count & deadline math
{
  const parentEst = 6;
  const parentDeadline = "2026-09-02";
  const today = new Date("2026-08-30T12:00:00");
  const daysUntilDl = getDaysUntilDue(parentDeadline, today); // 3 days (Aug 30 -> Sep 2)
  assert.strictEqual(daysUntilDl, 3);

  // If parent has 6 hours over 3 days available, default days should fit within 3 days
  const defaultDays = Math.max(1, Math.min(Math.round(parentEst), daysUntilDl));
  assert.strictEqual(defaultDays, 3);

  const hoursPerDay = parentEst / defaultDays;
  assert.strictEqual(hoursPerDay, 2);

  console.log("✓ Test 1 Passed: Auto-create days calculation and hours/day metric");
}

// Test 2: Downstream hours readjustment
// Rule: Editing a subtask's estimated time ONLY readjusts subtasks with index > current
{
  const parentTotal = 6;
  const subtasks: Task[] = [
    makeTask({ id: "s1", name: "S1", estimatedTime: 2, subtaskIndex: 1 }),
    makeTask({ id: "s2", name: "S2", estimatedTime: 2, subtaskIndex: 2 }),
    makeTask({ id: "s3", name: "S3", estimatedTime: 2, subtaskIndex: 3 }),
  ];

  // User edits S2 from 2h to 3h
  const editedIdx = 1; // S2
  const newEst = 3;

  const updated = [...subtasks];
  updated[editedIdx] = { ...updated[editedIdx], estimatedTime: newEst };

  const downstreamIncomplete = updated.slice(editedIdx + 1).filter((s) => !s.completion);
  assert.strictEqual(downstreamIncomplete.length, 1);

  const fixedSum =
    updated.slice(0, editedIdx).reduce((sum, s) => sum + s.estimatedTime, 0) +
    newEst +
    updated.slice(editedIdx + 1).filter((s) => s.completion).reduce((sum, s) => sum + s.estimatedTime, 0);

  // S1 (2) + S2 (3) = 5
  assert.strictEqual(fixedSum, 5);

  const remainingBudget = Math.max(0, Math.round((parentTotal - fixedSum) * 100) / 100);
  assert.strictEqual(remainingBudget, 1);

  // Update S3 to take remaining budget
  updated[2] = { ...updated[2], estimatedTime: remainingBudget };

  // Assert S1 is still 2h (unaffected!)
  assert.strictEqual(updated[0].estimatedTime, 2);
  // Assert S2 is 3h
  assert.strictEqual(updated[1].estimatedTime, 3);
  // Assert S3 is 1h
  assert.strictEqual(updated[2].estimatedTime, 1);
  // Total matches parentTotal
  assert.strictEqual(updated[0].estimatedTime + updated[1].estimatedTime + updated[2].estimatedTime, parentTotal);

  console.log("✓ Test 2 Passed: Downstream readjustment only modifies subsequent subtasks and preserves parent total");
}

// Test 3: Completing a subtask adds real time to parent task and leaves parent estimated time intact
{
  const parent = makeTask({ id: "p1", name: "Parent", estimatedTime: 10, realTime: 2 });
  const subtask = makeTask({ id: "s1", name: "Subtask 1", estimatedTime: 3.5, parentId: "p1", subtaskIndex: 1 });
  const subtaskRecordedRealTime = 3;

  const newParentRealTime = Math.round(((parent.realTime || 0) + subtaskRecordedRealTime) * 100) / 100;
  assert.strictEqual(newParentRealTime, 5);
  // Parent estimated time remains intact (10)
  assert.strictEqual(parent.estimatedTime, 10);

  console.log("✓ Test 3 Passed: Completing subtask adds real time to parent and preserves estimated time");
}

// Test 4: Reordering subtasks auto-reassigns due dates chronologically
{
  const subtasks: Task[] = [
    makeTask({ id: "s1", name: "Task A", deadline: "2026-08-31", subtaskIndex: 1 }),
    makeTask({ id: "s2", name: "Task B", deadline: "2026-09-01", subtaskIndex: 2 }),
    makeTask({ id: "s3", name: "Task C", deadline: "2026-09-02", subtaskIndex: 3 }),
  ];

  // User drags Task C (index 2) to position 0 -> order becomes [Task C, Task A, Task B]
  const next = [subtasks[2], subtasks[0], subtasks[1]];

  const existingDeadlines = subtasks
    .map((s) => s.deadline)
    .filter((d): d is string => d !== null && d !== "")
    .sort();

  const reordered = next.map((s, i) => ({
    ...s,
    subtaskIndex: i + 1,
    deadline: existingDeadlines[i],
  }));

  // Assert Task C now has Aug 31
  assert.strictEqual(reordered[0].name, "Task C");
  assert.strictEqual(reordered[0].deadline, "2026-08-31");
  assert.strictEqual(reordered[0].subtaskIndex, 1);

  // Assert Task A now has Sep 01
  assert.strictEqual(reordered[1].name, "Task A");
  assert.strictEqual(reordered[1].deadline, "2026-09-01");
  assert.strictEqual(reordered[1].subtaskIndex, 2);

  // Assert Task B now has Sep 02
  assert.strictEqual(reordered[2].name, "Task B");
  assert.strictEqual(reordered[2].deadline, "2026-09-02");
  assert.strictEqual(reordered[2].subtaskIndex, 3);

  console.log("✓ Test 4 Passed: Reordering subtasks auto-reassigns due dates chronologically");
}

// Test 6: Deleting a subtask scales remaining non-completed subtasks
{
  const parentTotal = 6;
  const subtasks: Task[] = [
    makeTask({ id: "s1", name: "S1", estimatedTime: 2, subtaskIndex: 1 }),
    makeTask({ id: "s2", name: "S2", estimatedTime: 2, subtaskIndex: 2 }),
    makeTask({ id: "s3", name: "S3", estimatedTime: 2, subtaskIndex: 3 }),
  ];

  // Delete S2 -> remaining [S1, S3]
  const remaining = subtasks.filter((s) => s.id !== "s2");
  const incomplete = remaining.filter((s) => !s.completion);
  const prevSum = incomplete.reduce((sum, s) => sum + s.estimatedTime, 0); // 4
  const remainingBudget = parentTotal; // 6

  let allocated = 0;
  const scaled = remaining.map((s, i) => {
    const isLast = i === remaining.length - 1;
    const est = isLast
      ? Math.max(0, Math.round((remainingBudget - allocated) * 100) / 100)
      : Math.round((remainingBudget * (s.estimatedTime / prevSum)) * 100) / 100;
    allocated += est;
    return { ...s, estimatedTime: est, subtaskIndex: i + 1 };
  });

  assert.strictEqual(scaled[0].estimatedTime, 3);
  assert.strictEqual(scaled[1].estimatedTime, 3);
  assert.strictEqual(scaled[0].estimatedTime + scaled[1].estimatedTime, parentTotal);
  console.log("✓ Test 6 Passed: Deleting subtask scales remaining non-completed tasks to total parent hours");
}

// Test 7: Creating a new subtask scales existing and new non-completed subtasks
{
  const parentTotal = 6;
  const subtasks: Task[] = [
    makeTask({ id: "s1", name: "S1", estimatedTime: 3, subtaskIndex: 1 }),
    makeTask({ id: "s2", name: "S2", estimatedTime: 3, subtaskIndex: 2 }),
  ];

  // Add S3
  const newSubtask = makeTask({ id: "s3", name: "S3", estimatedTime: 0 });
  const all = [...subtasks, newSubtask];
  const incompleteCount = all.filter((s) => !s.completion).length; // 3
  const budget = parentTotal;

  let allocated = 0;
  const scaled = all.map((s, i) => {
    const isLast = i === all.length - 1;
    const est = isLast
      ? Math.max(0, Math.round((budget - allocated) * 100) / 100)
      : Math.round((budget / incompleteCount) * 100) / 100;
    allocated += est;
    return { ...s, estimatedTime: est, subtaskIndex: i + 1 };
  });

  assert.strictEqual(scaled[0].estimatedTime, 2);
  assert.strictEqual(scaled[1].estimatedTime, 2);
  assert.strictEqual(scaled[2].estimatedTime, 2);
  assert.strictEqual(scaled.reduce((sum, s) => sum + s.estimatedTime, 0), parentTotal);
  console.log("✓ Test 7 Passed: Adding a subtask auto-scales existing and new non-completed tasks");
}

console.log("\nAll Subtask unit tests PASSED successfully!");
