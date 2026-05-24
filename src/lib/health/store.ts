import { formatISO } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { exerciseById, mealOptions, pullUpMilestones } from "@/lib/health/program-data";
import {
  calculateStreak,
  createInitialLoggedSets,
  detectPR,
  getCurrentWeek,
  getPhaseByWeek,
  getWorkoutByDay,
} from "@/lib/health/selectors";
import type {
  ActiveWorkout,
  AppState,
  CalisthenicsTest,
  DailyNutrition,
  MealEntry,
  MealType,
  WeekdayKey,
  WorkoutDay,
  WorkoutLog,
} from "@/lib/health/types";

interface GymState extends AppState {
  selectedTab: "today" | "program" | "log" | "progress" | "nutrition";
  programPhaseView: 1 | 2 | 3;
  programDayView: WeekdayKey;
  setSelectedTab: (tab: GymState["selectedTab"]) => void;
  setProgramView: (phase: 1 | 2 | 3, day: WeekdayKey) => void;
  setStartDate: (dateIso: string) => void;
  setCurrentWeekOverride: (week: number | null) => void;
  logBodyWeight: (dateIso: string, weight: number) => void;
  startWorkout: (week: number, day: WorkoutDay) => void;
  updateWorkoutSet: (
    exerciseId: string,
    setNumber: number,
    patch: Partial<{ weight: number; reps: number; completed: boolean }>,
  ) => void;
  markTimedSet: (exerciseId: string, setNumber: number, seconds: number) => void;
  finishWorkout: () => WorkoutLog | null;
  cancelWorkout: () => void;
  addMeal: (dateIso: string, meal: MealType, item: string, protein: number, calories: number) => void;
  quickAddMeal: (dateIso: string, label: string, protein: number, calories: number) => void;
  deleteMeal: (dateIso: string, mealId: string) => void;
  setWaterGlasses: (dateIso: string, value: number) => void;
  toggleCreatine: (dateIso: string) => void;
  setMilestoneDate: (milestone: string, dateIso: string | null) => void;
  addCalisthenicsTest: (test: CalisthenicsTest) => void;
}

const defaultStartDate = formatISO(new Date(), { representation: "date" });

const createDefaultMilestones = () =>
  Object.fromEntries(pullUpMilestones.map((milestone) => [milestone, null])) as Record<string, string | null>;

const createDailyNutrition = (date: string): DailyNutrition => ({
  date,
  meals: [],
  waterGlasses: 0,
  creatineTaken: false,
});

const initialState: AppState = {
  currentWeekOverride: null,
  startDate: defaultStartDate,
  bodyWeightLog: [{ date: defaultStartDate, weight: 62 }],
  activeWorkout: null,
  workoutHistory: [],
  nutritionLogs: [],
  pullUpMilestones: createDefaultMilestones(),
  calisthenicsTests: [],
  currentStreak: 0,
  longestStreak: 0,
};

const initialUiState = {
  selectedTab: "today" as const,
  programPhaseView: 1 as const,
  programDayView: "monday" as const,
};

function withStreak(state: GymState) {
  const streak = calculateStreak(state.workoutHistory);
  return {
    ...state,
    currentStreak: streak.current,
    longestStreak: streak.longest,
  };
}

function upsertNutritionLog(logs: DailyNutrition[], date: string): DailyNutrition[] {
  if (logs.some((entry) => entry.date === date)) return logs;
  return [...logs, createDailyNutrition(date)];
}

function normalizeMeal(meal: string): MealType {
  const match = mealOptions.find((option) => option === meal);
  return match ?? "Snack";
}

export const useGymStore = create<GymState>()(
  persist(
    (set, get) => ({
      ...initialState,
      ...initialUiState,
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setProgramView: (phase, day) => set({ programPhaseView: phase, programDayView: day }),
      setStartDate: (dateIso) => set({ startDate: dateIso, currentWeekOverride: null }),
      setCurrentWeekOverride: (week) => set({ currentWeekOverride: week }),
      logBodyWeight: (dateIso, weight) =>
        set((state) => {
          const next = state.bodyWeightLog.filter((entry) => entry.date !== dateIso);
          next.push({ date: dateIso, weight });
          return { bodyWeightLog: next.sort((a, b) => a.date.localeCompare(b.date)) };
        }),
      startWorkout: (week, day) =>
        set((state) => {
          const findPreviousSets = (exerciseId: string) => {
            const previous = state.workoutHistory.find((log) =>
              log.exercises.some((exercise) => exercise.exerciseId === exerciseId),
            );
            const previousExercise = previous?.exercises.find((exercise) => exercise.exerciseId === exerciseId);
            return previousExercise?.sets ?? [];
          };

          return {
            activeWorkout: {
              startedAt: new Date().toISOString(),
              weekNumber: week,
              phase: getPhaseByWeek(week),
              dayOfWeek: day.dayOfWeek,
              workoutName: day.name,
              exercises: day.exercises.map((exercise) => {
                const baseSets = createInitialLoggedSets(exercise);
                const previousSets = findPreviousSets(exercise.exerciseId);
                return {
                  exerciseId: exercise.exerciseId,
                  sets: baseSets.map((setEntry, index) => ({
                    ...setEntry,
                    weight: previousSets[index]?.weight ?? setEntry.weight,
                    reps: previousSets[index]?.reps ?? setEntry.reps,
                  })),
                };
              }),
            },
          };
        }),
      updateWorkoutSet: (exerciseId, setNumber, patch) =>
        set((state) => {
          if (!state.activeWorkout) return state;
          const nextWorkout: ActiveWorkout = {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((exercise) => {
              if (exercise.exerciseId !== exerciseId) return exercise;
              return {
                ...exercise,
                sets: exercise.sets.map((setEntry) =>
                  setEntry.setNumber === setNumber ? { ...setEntry, ...patch } : setEntry,
                ),
              };
            }),
          };
          return { activeWorkout: nextWorkout };
        }),
      markTimedSet: (exerciseId, setNumber, seconds) =>
        get().updateWorkoutSet(exerciseId, setNumber, { reps: seconds, completed: true }),
      finishWorkout: () => {
        const state = get();
        if (!state.activeWorkout) return null;
        const finishedAt = new Date();
        const duration = Math.max(
          1,
          Math.floor((finishedAt.getTime() - new Date(state.activeWorkout.startedAt).getTime()) / 1000),
        );

        const exercisesWithPr = state.activeWorkout.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((setEntry) => ({
            ...setEntry,
            isPR: setEntry.completed
              ? detectPR(state.workoutHistory, exercise.exerciseId, setEntry.weight, setEntry.reps)
              : false,
          })),
        }));

        const log: WorkoutLog = {
          id: crypto.randomUUID(),
          date: finishedAt.toISOString(),
          workoutDayName: state.activeWorkout.workoutName,
          weekNumber: state.activeWorkout.weekNumber,
          phase: state.activeWorkout.phase,
          duration,
          exercises: exercisesWithPr.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            sets: exercise.sets,
          })),
        };

        const withLog = {
          ...state,
          activeWorkout: null,
          workoutHistory: [log, ...state.workoutHistory],
        };
        set(withStreak(withLog));
        return log;
      },
      cancelWorkout: () => set({ activeWorkout: null }),
      addMeal: (dateIso, meal, item, protein, calories) =>
        set((state) => {
          const logs = upsertNutritionLog(state.nutritionLogs, dateIso);
          return {
            nutritionLogs: logs.map((entry) =>
              entry.date !== dateIso
                ? entry
                : {
                    ...entry,
                    meals: [
                      ...entry.meals,
                      {
                        id: crypto.randomUUID(),
                        meal: normalizeMeal(meal),
                        item,
                        protein,
                        calories,
                      },
                    ],
                  },
            ),
          };
        }),
      quickAddMeal: (dateIso, label, protein, calories) =>
        get().addMeal(dateIso, "Snack", label, protein, calories),
      deleteMeal: (dateIso, mealId) =>
        set((state) => ({
          nutritionLogs: state.nutritionLogs.map((entry) =>
            entry.date !== dateIso ? entry : { ...entry, meals: entry.meals.filter((meal) => meal.id !== mealId) },
          ),
        })),
      setWaterGlasses: (dateIso, value) =>
        set((state) => {
          const logs = upsertNutritionLog(state.nutritionLogs, dateIso);
          return {
            nutritionLogs: logs.map((entry) =>
              entry.date !== dateIso ? entry : { ...entry, waterGlasses: Math.max(0, Math.min(8, value)) },
            ),
          };
        }),
      toggleCreatine: (dateIso) =>
        set((state) => {
          const logs = upsertNutritionLog(state.nutritionLogs, dateIso);
          return {
            nutritionLogs: logs.map((entry) =>
              entry.date !== dateIso ? entry : { ...entry, creatineTaken: !entry.creatineTaken },
            ),
          };
        }),
      setMilestoneDate: (milestone, dateIso) =>
        set((state) => ({
          pullUpMilestones: {
            ...state.pullUpMilestones,
            [milestone]: dateIso,
          },
        })),
      addCalisthenicsTest: (test) =>
        set((state) => ({
          calisthenicsTests: [...state.calisthenicsTests, test].sort((a, b) => a.date.localeCompare(b.date)),
        })),
    }),
    {
      name: "gym-tracker-v1",
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<GymState>;
        return {
          ...initialState,
          ...initialUiState,
          ...state,
          pullUpMilestones: {
            ...createDefaultMilestones(),
            ...(state.pullUpMilestones ?? {}),
          },
        };
      },
      partialize: (state) => ({
        currentWeekOverride: state.currentWeekOverride,
        startDate: state.startDate,
        bodyWeightLog: state.bodyWeightLog,
        activeWorkout: state.activeWorkout,
        workoutHistory: state.workoutHistory,
        nutritionLogs: state.nutritionLogs,
        pullUpMilestones: state.pullUpMilestones,
        calisthenicsTests: state.calisthenicsTests,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        programDayView: state.programDayView,
        programPhaseView: state.programPhaseView,
        selectedTab: state.selectedTab,
      }),
    },
  ),
);

export function getWorkoutTemplateForToday(startDate: string, weekOverride: number | null, date = new Date()) {
  const week = weekOverride ?? getCurrentWeek(startDate, date);
  const dayKey = (date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() as WeekdayKey) ?? "monday";
  const day = getWorkoutByDay(getPhaseByWeek(week), dayKey);
  return { week, day };
}

export function getExerciseTypeById(exerciseId: string) {
  return exerciseById[exerciseId]?.type ?? "bodyweight";
}

export function getNutritionForDate(logs: DailyNutrition[], dateIso: string) {
  return logs.find((entry) => entry.date === dateIso) ?? createDailyNutrition(dateIso);
}

export function getNutritionTotals(entry: DailyNutrition) {
  return entry.meals.reduce(
    (acc, meal) => ({
      protein: acc.protein + meal.protein,
      calories: acc.calories + meal.calories,
    }),
    { protein: 0, calories: 0 },
  );
}

export function getMealBreakdown(entry: DailyNutrition): Record<MealType, MealEntry[]> {
  return mealOptions.reduce(
    (acc, meal) => {
      acc[meal] = entry.meals.filter((item) => item.meal === meal);
      return acc;
    },
    {} as Record<MealType, MealEntry[]>,
  );
}
