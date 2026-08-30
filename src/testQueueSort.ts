import assert from "node:assert";
import { groupAndSortQueues } from "../src/lib/queueUtils.ts";
import type { Task } from "../src/types/task.ts";

const mockToday = new Date("2026-08-30T12:00:00");

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    name: "Test Task",
    estimatedTime: 1,
    realTime: 0,
    deadline: null,
    priority: "Medium",
    queue: "Tasks",
    completion: false,
    missed: false,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

console.log("Running comprehensive queue sorting tests...\n");

// Test 1: Hierarchy Tiers: Overdue > Due Today > Due Upcoming > No Deadline > Empty
{
  const tasks: Task[] = [
    makeTask({ name: "Upcoming", queue: "Q_Upcoming", deadline: "2026-09-02", priority: "High", estimatedTime: 10 }),
    makeTask({ name: "Overdue", queue: "Q_Overdue", deadline: "2026-08-25", priority: "Low", estimatedTime: 1 }),
    makeTask({ name: "Due Today", queue: "Q_Today", deadline: "2026-08-30", priority: "Medium", estimatedTime: 2 }),
    makeTask({ name: "No Deadline", queue: "Q_NoDeadline", deadline: null, priority: "High", estimatedTime: 5 }),
    makeTask({ name: "Completed", queue: "Q_Empty", deadline: "2026-08-20", completion: true }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  const queueOrder = sorted.map((q) => q.name);

  assert.deepStrictEqual(queueOrder, [
    "Q_Overdue",
    "Q_Today",
    "Q_Upcoming",
    "Q_NoDeadline",
    "Q_Empty",
    "Tasks", // default empty queue
  ]);
  console.log("✓ Test 1 Passed: Overdue > Today > Upcoming > No Deadline > Empty");
}

// Test 2: Overdue tie-break by earliest overdue date (longer past due first)
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_Overdue_2d", deadline: "2026-08-28" }),
    makeTask({ queue: "Q_Overdue_5d", deadline: "2026-08-25" }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_Overdue_5d");
  assert.strictEqual(sorted[1].name, "Q_Overdue_2d");
  console.log("✓ Test 2 Passed: Earlier overdue date ranks higher");
}

// Test 3: Upcoming tie-break by soonest deadline (earlier upcoming first)
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_NextWeek", deadline: "2026-09-07" }),
    makeTask({ queue: "Q_Tomorrow", deadline: "2026-08-31" }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_Tomorrow");
  assert.strictEqual(sorted[1].name, "Q_NextWeek");
  console.log("✓ Test 3 Passed: Soonest upcoming deadline ranks higher");
}

// Test 4: Same date tie-break by highest priority (High > Medium > Low)
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_Med", deadline: "2026-08-30", priority: "Medium", estimatedTime: 20 }),
    makeTask({ queue: "Q_High", deadline: "2026-08-30", priority: "High", estimatedTime: 1 }),
    makeTask({ queue: "Q_Low", deadline: "2026-08-30", priority: "Low", estimatedTime: 50 }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_High");
  assert.strictEqual(sorted[1].name, "Q_Med");
  assert.strictEqual(sorted[2].name, "Q_Low");
  console.log("✓ Test 4 Passed: Same date tie-break by highest priority (High > Medium > Low)");
}

// Test 5: Same date & same highest priority tie-break by High priority hours
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_High_2h", deadline: "2026-08-30", priority: "High", estimatedTime: 2 }),
    makeTask({ queue: "Q_High_8h", deadline: "2026-08-30", priority: "High", estimatedTime: 8 }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_High_8h");
  assert.strictEqual(sorted[1].name, "Q_High_2h");
  console.log("✓ Test 5 Passed: Same date & same top priority tie-break by High hours (8h > 2h)");
}

// Test 6: Same date & same High hours tie-break by Medium priority hours
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_Med_3h", deadline: "2026-08-30", priority: "High", estimatedTime: 4 }),
    makeTask({ queue: "Q_Med_3h", deadline: "2026-08-30", priority: "Medium", estimatedTime: 3 }),

    makeTask({ queue: "Q_Med_10h", deadline: "2026-08-30", priority: "High", estimatedTime: 4 }),
    makeTask({ queue: "Q_Med_10h", deadline: "2026-08-30", priority: "Medium", estimatedTime: 10 }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_Med_10h");
  assert.strictEqual(sorted[1].name, "Q_Med_3h");
  console.log("✓ Test 6 Passed: Equal High hours tie-break by Medium hours (10h > 3h)");
}

// Test 7: Same date & same High + Medium hours tie-break by Low priority hours
{
  const tasks: Task[] = [
    makeTask({ queue: "Q_Low_1h", deadline: "2026-08-30", priority: "High", estimatedTime: 2 }),
    makeTask({ queue: "Q_Low_1h", deadline: "2026-08-30", priority: "Medium", estimatedTime: 2 }),
    makeTask({ queue: "Q_Low_1h", deadline: "2026-08-30", priority: "Low", estimatedTime: 1 }),

    makeTask({ queue: "Q_Low_6h", deadline: "2026-08-30", priority: "High", estimatedTime: 2 }),
    makeTask({ queue: "Q_Low_6h", deadline: "2026-08-30", priority: "Medium", estimatedTime: 2 }),
    makeTask({ queue: "Q_Low_6h", deadline: "2026-08-30", priority: "Low", estimatedTime: 6 }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  assert.strictEqual(sorted[0].name, "Q_Low_6h");
  assert.strictEqual(sorted[1].name, "Q_Low_1h");
  console.log("✓ Test 7 Passed: Equal High+Medium hours tie-break by Low hours (6h > 1h)");
}

// Test 8: Internal tasks inside queue are sorted in urgency order
{
  const tasks: Task[] = [
    makeTask({ name: "T_Future", queue: "Q_Multi", deadline: "2026-09-05", priority: "High" }),
    makeTask({ name: "T_Overdue", queue: "Q_Multi", deadline: "2026-08-20", priority: "Low" }),
    makeTask({ name: "T_Today", queue: "Q_Multi", deadline: "2026-08-30", priority: "Medium" }),
  ];

  const sorted = groupAndSortQueues(tasks, mockToday);
  const qMulti = sorted.find((q) => q.name === "Q_Multi")!;
  assert.deepStrictEqual(
    qMulti.tasks.map((t) => t.name),
    ["T_Overdue", "T_Today", "T_Future"]
  );
  console.log("✓ Test 8 Passed: Internal tasks inside each queue sorted in urgency order");
}

console.log("\nAll queue sorting unit tests PASSED successfully!");
