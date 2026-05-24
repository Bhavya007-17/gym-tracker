import { differenceInCalendarDays, format, parseISO } from "date-fns";

import { dayOrder, exerciseById, workoutPhases } from "@/lib/health/program-data";
import type {
  ActiveWorkout,
  WorkoutDay,
  WorkoutExercise,
  WorkoutLog,
  WeekdayKey,
} from "@/lib/health/types";

export const WEEKLY_PLANNED_SESSIONS = 6;

export function getCurrentWeek(startDate: string, now = new Date()): number {
  const diff = Math.max(0, differenceInCalendarDays(now, parseISO(startDate)));
  return Math.min(12, Math.floor(diff / 7) + 1);
}

export function getPhaseByWeek(week: number): 1 | 2 | 3 {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  return 3;
}

export function getPhase(week: number) {
  return workoutPhases.find((phase) => phase.id === getPhaseByWeek(week)) ?? workoutPhases[0];
}

export function getWeekdayKey(date = new Date()): WeekdayKey {
  const key = format(date, "EEEE").toLowerCase() as WeekdayKey;
  return key;
}

export function isRestDay(date = new Date()): boolean {
  return getWeekdayKey(date) === "sunday";
}

export function getWorkoutForDate(week: number, date = new Date()): WorkoutDay | null {
  if (isRestDay(date)) return null;
  const phase = getPhase(week);
  const day = getWeekdayKey(date);
  return phase.days.find((entry) => entry.dayOfWeek === day) ?? null;
}

export function getWorkoutByDay(phaseId: number, day: WeekdayKey): WorkoutDay | null {
  const phase = workoutPhases.find((entry) => entry.id === phaseId);
  if (!phase) return null;
  return phase.days.find((entry) => entry.dayOfWeek === day) ?? null;
}

export function createInitialLoggedSets(exercise: WorkoutExercise) {
  return Array.from({ length: exercise.sets }).map((_, index) => ({
    setNumber: index + 1,
    weight: 0,
    reps: 0,
    completed: false,
    isPR: false,
  }));
}

export function calculateWorkoutVolume(log: WorkoutLog | ActiveWorkout | null): number {
  if (!log) return 0;
  return log.exercises.reduce((volume, exercise) => {
    const setVolume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    return volume + setVolume;
  }, 0);
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}m ${rem.toString().padStart(2, "0")}s`;
}

export function getPreviousBest(logs: WorkoutLog[], exerciseId: string): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  logs.forEach((log) => {
    const match = log.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    if (!match) return;
    match.sets.forEach((set) => {
      if (!set.completed) return;
      if (!best) {
        best = { weight: set.weight, reps: set.reps };
        return;
      }
      const currentScore = set.weight * set.reps;
      const bestScore = best.weight * best.reps;
      if (currentScore > bestScore) {
        best = { weight: set.weight, reps: set.reps };
      }
    });
  });
  return best;
}

export function detectPR(
  logs: WorkoutLog[],
  exerciseId: string,
  weight: number,
  reps: number,
): boolean {
  const prev = getPreviousBest(logs, exerciseId);
  if (!prev) return weight > 0 || reps > 0;
  return weight * reps > prev.weight * prev.reps;
}

export function getConsistencyScore(logs: WorkoutLog[], startDate: string, now = new Date()): number {
  const week = getCurrentWeek(startDate, now);
  const planned = Math.max(1, week * WEEKLY_PLANNED_SESSIONS);
  return Math.round((logs.length / planned) * 100);
}

export function calculateStreak(logs: WorkoutLog[]): { current: number; longest: number } {
  if (!logs.length) return { current: 0, longest: 0 };
  const trainedDays = Array.from(new Set(logs.map((log) => log.date.slice(0, 10)))).sort();

  let current = 1;
  let longest = 1;
  for (let index = 1; index < trainedDays.length; index += 1) {
    const prev = parseISO(trainedDays[index - 1]);
    const next = parseISO(trainedDays[index]);
    const diff = differenceInCalendarDays(next, prev);
    if (diff === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return { current, longest };
}

export function getWeeklyVolume(logs: WorkoutLog[]): Array<{ week: string; volume: number }> {
  const bucket = new Map<number, number>();
  logs.forEach((log) => {
    const next = bucket.get(log.weekNumber) ?? 0;
    bucket.set(log.weekNumber, next + calculateWorkoutVolume(log));
  });
  return Array.from(bucket.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, volume]) => ({ week: `W${week}`, volume }));
}

export function getWorkoutTypeLabel(name: string): "Push" | "Pull" | "Abs" {
  if (name.toLowerCase().includes("push")) return "Push";
  if (name.toLowerCase().includes("pull")) return "Pull";
  return "Abs";
}

export function getExerciseBadge(exerciseId: string): "Bodyweight" | "Weighted" | "Machine" {
  const exercise = exerciseById[exerciseId];
  if (!exercise) return "Bodyweight";
  if (exercise.type === "machine") return "Machine";
  if (exercise.type === "weighted") return "Weighted";
  return "Bodyweight";
}

export function getDayName(day: WeekdayKey): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function getNextTrainingDay(day: WeekdayKey): WeekdayKey {
  const index = dayOrder.indexOf(day);
  for (let offset = 1; offset <= dayOrder.length; offset += 1) {
    const next = dayOrder[(index + offset) % dayOrder.length];
    if (next !== "sunday") return next;
  }
  return "monday";
}
