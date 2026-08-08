import { describe, expect, it } from "vitest";
import { sortByDueThenPriority, toMeetingCard } from "@/lib/dashboard-utils";
import type { Meeting, Task } from "@/lib/db";

const baseMeeting: Meeting = {
  id: "meeting-1",
  date: new Date("2026-09-10T15:00:00.000Z"),
  title: "Weekly MUN Meeting",
  location: "Room 137",
  type: "regular",
  agenda: "Debate and announcements",
  notes: null,
  responsibleEmail: null,
  reminderSentAt: null,
  archivedAt: null,
  minutesDocId: null,
  minutesDocUrl: null,
  minutesDocCreatedAt: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
};

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    description: "Prepare placards",
    completed: false,
    completedAt: null,
    dueDate: null,
    priority: "medium",
    label: null,
    sortOrder: 0,
    meetingId: "meeting-1",
    executiveId: "exec-1",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("meeting readiness", () => {
  it("links incomplete regular-meeting steps to their workspace sections", () => {
    const card = toMeetingCard({ ...baseMeeting, topicGuide: null, announcement: null }, []);
    expect(card.ready).toBe(false);
    expect(card.checks.map((check) => check.id)).toEqual(["agenda", "guide", "publish"]);
    expect(card.checks[1].href).toBe("/meetings/meeting-1#topic-guide");
  });

  it("marks a prepared executive meeting ready", () => {
    const card = toMeetingCard({ ...baseMeeting, type: "exec", minutesDocUrl: "https://docs.example/minutes" }, [task({})]);
    expect(card.ready).toBe(true);
    expect(card.checks.every((check) => check.done)).toBe(true);
  });
});

describe("task ordering", () => {
  it("puts the earliest due date first, then higher priority", () => {
    const rows = [task({ id: "low", priority: "low" }), task({ id: "high", priority: "high" }), task({ id: "dated", dueDate: new Date("2026-08-10") })];
    rows.sort(sortByDueThenPriority);
    expect(rows.map((row) => row.id)).toEqual(["dated", "high", "low"]);
  });
});
