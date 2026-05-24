import { describe, expect, it } from "vitest";

import {
  calculateStreak,
  calculateWorkoutVolume,
  detectPR,
  getConsistencyScore,
  getCurrentWeek,
  getPhaseByWeek,
  getWeeklyVolume,
  isRestDay,
} from "@/lib/health/selectors";
import type { WorkoutLog } from "@/lib/health/types";

const sampleLog = (id: string, date: string, weekNumber: number, weight: number, reps: number): WorkoutLog => ({
  id,
  date,
  workoutDayName: "Push HEAVY",
  weekNumber,
  phase: getPhaseByWeek(weekNumber),
  duration: 1800,
  exercises: [
    {
      exerciseId: "bench-press",
      sets: [
        { setNumber: 1, weight, reps, completed: true, isPR: false },
        { setNumber: 2, weight, reps, completed: true, isPR: false },
      ],
    },
  ],
});

describe("health selectors", () => {
  it("calculates current week from start date", () => {
    const week = getCurrentWeek("2026-05-01", new Date("2026-05-22"));
    expect(week).toBe(4);
  });

  it("resolves phase boundaries", () => {
    expect(getPhaseByWeek(1)).toBe(1);
    expect(getPhaseByWeek(6)).toBe(2);
    expect(getPhaseByWeek(11)).toBe(3);
  });

  it("recognizes sunday as rest day", () => {
    expect(isRestDay(new Date("2026-05-24"))).toBe(true);
    expect(isRestDay(new Date("2026-05-25"))).toBe(false);
  });

  it("computes workout volume", () => {
    const volume = calculateWorkoutVolume(sampleLog("a", "2026-05-21T10:00:00.000Z", 3, 40, 8));
    expect(volume).toBe(640);
  });

  it("detects personal records", () => {
    const logs = [sampleLog("a", "2026-05-21T10:00:00.000Z", 3, 40, 8)];
    expect(detectPR(logs, "bench-press", 42.5, 8)).toBe(true);
    expect(detectPR(logs, "bench-press", 35, 8)).toBe(false);
  });

  it("calculates consistency score", () => {
    const logs = [
      sampleLog("a", "2026-05-21T10:00:00.000Z", 3, 40, 8),
      sampleLog("b", "2026-05-22T10:00:00.000Z", 3, 40, 8),
      sampleLog("c", "2026-05-23T10:00:00.000Z", 3, 40, 8),
    ];
    const score = getConsistencyScore(logs, "2026-05-01", new Date("2026-05-24"));
    expect(score).toBe(13);
  });

  it("builds streak and weekly buckets", () => {
    const logs = [
      sampleLog("a", "2026-05-20T10:00:00.000Z", 3, 40, 8),
      sampleLog("b", "2026-05-21T10:00:00.000Z", 3, 40, 8),
      sampleLog("c", "2026-05-23T10:00:00.000Z", 4, 45, 6),
    ];
    const streak = calculateStreak(logs);
    const weeks = getWeeklyVolume(logs);
    expect(streak.longest).toBe(2);
    expect(weeks).toEqual([
      { week: "W3", volume: 1280 },
      { week: "W4", volume: 540 },
    ]);
  });
});
