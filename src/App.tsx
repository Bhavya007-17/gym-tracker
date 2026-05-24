import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfWeek, subDays } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { athleteProfile, dayOrder, exerciseById, mealOptions, pullUpMilestones, quickFoodPresets, workoutPhases } from "@/lib/health/program-data";
import {
  calculateWorkoutVolume,
  formatDuration,
  getConsistencyScore,
  getCurrentWeek,
  getDayName,
  getExerciseBadge,
  getNextTrainingDay,
  getPhaseByWeek,
  getWeeklyVolume,
  getWorkoutByDay,
  getWorkoutTypeLabel,
  isRestDay,
} from "@/lib/health/selectors";
import { getExerciseTypeById, getNutritionForDate, getNutritionTotals, useGymStore } from "@/lib/health/store";
import type { MealType, WeekdayKey, WorkoutLog } from "@/lib/health/types";

const tabOptions = [
  { id: "today", label: "Today" },
  { id: "program", label: "Program" },
  { id: "log", label: "Log" },
  { id: "progress", label: "Progress" },
  { id: "nutrition", label: "Nutrition" },
] as const;

function badgeClass(type: "Bodyweight" | "Weighted" | "Machine") {
  if (type === "Weighted") return "bg-[#448AFF]/20 text-[#8FB5FF] border-[#448AFF]/40";
  if (type === "Machine") return "bg-[#AA00FF]/20 text-[#D08AFF] border-[#AA00FF]/40";
  return "bg-[#00E676]/15 text-[#8DF3B8] border-[#00E676]/40";
}

function CircularProgress({
  value,
  target,
  label,
  unit,
  color,
}: {
  value: number;
  target: number;
  label: string;
  unit: string;
  color: string;
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round((value / target) * 100)));
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="grid h-28 w-28 place-items-center rounded-full border border-[#2A2A30]"
        style={{ background: `conic-gradient(${color} ${safeValue}%, #1A1A1F ${safeValue}%)` }}
      >
        <div className="grid h-22 w-22 place-items-center rounded-full bg-[#0D0D0F] text-center">
          <p className="text-sm font-semibold text-white">{value}</p>
          <p className="text-[11px] text-[#8B8B95]">/ {target} {unit}</p>
        </div>
      </div>
      <p className="text-xs uppercase tracking-wide text-[#8B8B95]">{label}</p>
    </div>
  );
}

function Heatmap({ logs }: { logs: WorkoutLog[] }) {
  const trained = new Set(logs.map((entry) => entry.date.slice(0, 10)));
  const dates = Array.from({ length: 42 }).map((_, index) =>
    format(subDays(new Date(), 41 - index), "yyyy-MM-dd"),
  );
  return (
    <div className="grid grid-cols-7 gap-1 rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
      {dates.map((date) => (
        <div
          key={date}
          className={`h-4 rounded-sm ${trained.has(date) ? "bg-[#6C5CE7]" : "bg-[#222228]"}`}
          title={date}
        />
      ))}
    </div>
  );
}

export default function GymTrackerApp() {
  const {
    selectedTab,
    setSelectedTab,
    startDate,
    currentWeekOverride,
    setCurrentWeekOverride,
    setStartDate,
    bodyWeightLog,
    logBodyWeight,
    activeWorkout,
    workoutHistory,
    startWorkout,
    updateWorkoutSet,
    markTimedSet,
    finishWorkout,
    nutritionLogs,
    addMeal,
    quickAddMeal,
    deleteMeal,
    setWaterGlasses,
    toggleCreatine,
    pullUpMilestones: milestones,
    setMilestoneDate,
    calisthenicsTests,
    addCalisthenicsTest,
    currentStreak,
    longestStreak,
    programPhaseView,
    programDayView,
    setProgramView,
  } = useGymStore();

  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showExerciseId, setShowExerciseId] = useState<string | null>(null);
  const [restCountdown, setRestCountdown] = useState(0);
  const [summaryLog, setSummaryLog] = useState<WorkoutLog | null>(null);
  const [summaryFlash, setSummaryFlash] = useState(false);
  const [rangeFilter, setRangeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "Push" | "Pull" | "Abs">("all");
  const [nutritionDate, setNutritionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mealForm, setMealForm] = useState({ meal: "Breakfast" as MealType, item: "", protein: "", calories: "" });
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const timedStarts = useRef<Record<string, number>>({});
  const [runningTimedSets, setRunningTimedSets] = useState<Record<string, boolean>>({});

  const currentWeek = currentWeekOverride ?? getCurrentWeek(startDate);
  const phase = getPhaseByWeek(currentWeek);
  const today = dayOrder[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] as WeekdayKey;
  const todayWorkout = getWorkoutByDay(phase, today);
  const isSunday = isRestDay(new Date());
  const dateNowIso = format(new Date(), "yyyy-MM-dd");
  const nutrition = getNutritionForDate(nutritionLogs, nutritionDate);
  const nutritionTotals = getNutritionTotals(nutrition);
  const plannedSessions = Math.max(1, currentWeek * 6);
  const consistencyScore = getConsistencyScore(workoutHistory, startDate);
  const totalVolume = workoutHistory.reduce((sum, log) => sum + calculateWorkoutVolume(log), 0);
  const currentWeight = bodyWeightLog.at(-1)?.weight ?? athleteProfile.startingWeightKg;
  const weightGain = Number((currentWeight - athleteProfile.startingWeightKg).toFixed(1));
  const weeklyVolume = getWeeklyVolume(workoutHistory);

  useEffect(() => {
    if (restCountdown <= 0) return;
    const timer = setTimeout(() => setRestCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [restCountdown]);

  const filteredLogs = useMemo(
    () =>
      workoutHistory.filter((entry) => {
        if (typeFilter !== "all" && getWorkoutTypeLabel(entry.workoutDayName) !== typeFilter) return false;
        if (rangeFilter === "all") return true;
        return String(entry.weekNumber) === rangeFilter;
      }),
    [workoutHistory, typeFilter, rangeFilter],
  );

  const keyLiftProgress = useMemo(() => {
    const keys = ["bench-press", "lat-pulldown-wide", "db-rows", "db-curls"];
    return workoutHistory
      .slice()
      .reverse()
      .map((log) => {
        const row: Record<string, string | number> = { date: format(new Date(log.date), "MM/dd") };
        keys.forEach((key) => {
          const exercise = log.exercises.find((entry) => entry.exerciseId === key);
          const best = exercise?.sets.reduce((acc, set) => Math.max(acc, set.weight * set.reps), 0) ?? 0;
          row[key] = best;
        });
        return row;
      });
  }, [workoutHistory]);

  const calisthenicsData = useMemo(() => {
    return calisthenicsTests.map((entry) => ({
      date: format(new Date(entry.date), "MM/dd"),
      value: entry.value,
      exercise: entry.exercise,
    }));
  }, [calisthenicsTests]);

  const proteinWeekData = useMemo(() => {
    const start = startOfWeek(new Date(nutritionDate), { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, index) => {
      const date = format(subDays(start, -index), "yyyy-MM-dd");
      const dayEntry = getNutritionForDate(nutritionLogs, date);
      const protein = dayEntry.meals.reduce((sum, meal) => sum + meal.protein, 0);
      return { day: format(new Date(date), "EEE"), protein };
    });
  }, [nutritionDate, nutritionLogs]);

  function handleStartWorkout() {
    if (!todayWorkout) return;
    startWorkout(currentWeek, todayWorkout);
    setSummaryLog(null);
  }

  function handleToggleSet(exerciseId: string, setNumber: number, restSeconds: number, completed: boolean) {
    updateWorkoutSet(exerciseId, setNumber, { completed: !completed });
    if (!completed && restSeconds > 0) setRestCountdown(restSeconds);
  }

  function handleTimedToggle(exerciseId: string, setNumber: number) {
    const key = `${exerciseId}-${setNumber}`;
    if (!timedStarts.current[key]) {
      timedStarts.current[key] = Date.now();
      setRunningTimedSets((prev) => ({ ...prev, [key]: true }));
      return;
    }
    const elapsed = Math.max(1, Math.floor((Date.now() - timedStarts.current[key]) / 1000));
    delete timedStarts.current[key];
    setRunningTimedSets((prev) => ({ ...prev, [key]: false }));
    markTimedSet(exerciseId, setNumber, elapsed);
  }

  function handleFinishWorkout() {
    const log = finishWorkout();
    if (!log) return;
    setSummaryLog(log);
    const prs = log.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.isPR).length;
    if (prs > 0) {
      setSummaryFlash(true);
      setTimeout(() => setSummaryFlash(false), 1600);
    }
  }

  function renderTodayView() {
    if (isSunday && !activeWorkout) {
      const next = getNextTrainingDay("sunday");
      return (
        <div className="space-y-4">
          <article className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-5">
            <p className="text-sm text-[#8B8B95]">Sunday recovery mode</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Rest Day</h2>
            <p className="mt-2 text-sm text-[#8B8B95]">
              Recovery is part of growth. Hydrate, hit calories, and prep for tomorrow.
            </p>
            <p className="mt-3 text-sm font-medium text-[#00E676]">Next workout: {getDayName(next)} - Push HEAVY</p>
          </article>
          <article className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-5">
            <h3 className="text-sm font-semibold text-white">Weekly snapshot</h3>
            <p className="mt-2 text-sm text-[#8B8B95]">
              Sessions completed: {workoutHistory.filter((entry) => entry.weekNumber === currentWeek).length} / 6
            </p>
            <p className="text-sm text-[#8B8B95]">Weekly volume: {weeklyVolume.at(-1)?.volume ?? 0}</p>
          </article>
        </div>
      );
    }

    if (!todayWorkout && !activeWorkout) {
      return <p className="text-sm text-[#8B8B95]">No workout configured for today.</p>;
    }

    const displayName = activeWorkout?.workoutName ?? todayWorkout?.name ?? "Workout";
    const displayDayExercises = activeWorkout
      ? activeWorkout.exercises.map((exercise) => {
          const template = todayWorkout?.exercises.find((entry) => entry.exerciseId === exercise.exerciseId);
          return {
            ...exercise,
            restSeconds: template?.restSeconds ?? 60,
            repsTarget: template?.reps ?? "8-12",
            supersetGroup: template?.supersetGroup,
            supersetOrder: template?.supersetOrder,
          };
        })
      : (todayWorkout?.exercises ?? []).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: Array.from({ length: exercise.sets }).map((_, index) => ({
            setNumber: index + 1,
            weight: 0,
            reps: 0,
            completed: false,
            isPR: false,
          })),
          restSeconds: exercise.restSeconds,
          repsTarget: exercise.reps,
          supersetGroup: exercise.supersetGroup,
          supersetOrder: exercise.supersetOrder,
        }));

    return (
      <div className={`space-y-4 ${summaryFlash ? "animate-pulse" : ""}`}>
        <article className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-5">
          <p className="text-xs uppercase tracking-wide text-[#8B8B95]">
            Week {currentWeek} - Phase {phase} - {getDayName(today)}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">{displayName}</h2>
          <p className="mt-2 text-sm text-[#FF9100]">🔥 {currentStreak} days in a row</p>
          {!activeWorkout ? (
            <button
              onClick={handleStartWorkout}
              className="mt-4 w-full rounded-xl bg-[#6C5CE7] py-3 text-sm font-semibold text-white transition hover:bg-[#7a6df0]"
            >
              Start Workout
            </button>
          ) : null}
        </article>

        {restCountdown > 0 ? (
          <article className="rounded-2xl border border-[#6C5CE7]/50 bg-[#6C5CE7]/10 p-3 text-sm text-[#C8C0FF]">
            Rest timer running: {restCountdown}s
          </article>
        ) : null}

        {displayDayExercises.map((exercise) => {
          const meta = exerciseById[exercise.exerciseId];
          if (!meta) return null;
          const badge = getExerciseBadge(exercise.exerciseId);
          return (
            <article key={exercise.exerciseId} className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => setShowExerciseId(exercise.exerciseId)}
                  className="text-left text-lg font-semibold text-white"
                >
                  {meta.name}
                </button>
                <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-wide ${badgeClass(badge)}`}>
                  {badge}
                </span>
              </div>

              {(exercise.supersetGroup && exercise.supersetOrder) ? (
                <p className="mt-1 text-xs font-semibold text-[#FF9100]">
                  SUPERSET {exercise.supersetGroup}{exercise.supersetOrder}
                </p>
              ) : null}

              <p className="mt-1 text-xs text-[#8B8B95]">
                Target: {exercise.sets.length} x {exercise.repsTarget} - {exercise.restSeconds}s rest
              </p>

              <div className="mt-3 space-y-2">
                {exercise.sets.map((setEntry) => {
                  const timerKey = `${exercise.exerciseId}-${setEntry.setNumber}`;
                  const timerRunning = Boolean(runningTimedSets[timerKey]);
                  const type = getExerciseTypeById(exercise.exerciseId);
                  return (
                    <div
                      key={`${exercise.exerciseId}-${setEntry.setNumber}`}
                      className={`grid grid-cols-12 items-center gap-2 rounded-lg border p-2 text-xs ${
                        setEntry.isPR ? "border-[#FFD600] bg-[#FFD600]/10" : "border-[#2A2A30] bg-[#222228]"
                      }`}
                    >
                      <p className="col-span-2 text-[#8B8B95]">Set {setEntry.setNumber}</p>
                      <input
                        type="number"
                        value={type === "bodyweight" && setEntry.weight === 0 ? "" : setEntry.weight}
                        onChange={(event) =>
                          updateWorkoutSet(exercise.exerciseId, setEntry.setNumber, {
                            weight: Number(event.target.value || 0),
                          })
                        }
                        placeholder={type === "bodyweight" ? "BW" : "kg"}
                        className="col-span-3 rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-1 text-white"
                      />
                      {type === "timed" ? (
                        <button
                          onClick={() => handleTimedToggle(exercise.exerciseId, setEntry.setNumber)}
                          className="col-span-4 rounded-md border border-[#6C5CE7]/50 bg-[#6C5CE7]/20 px-2 py-1 text-[#C8C0FF]"
                        >
                          {timerRunning ? "Stop" : "Start"} timer
                        </button>
                      ) : (
                        <input
                          type="number"
                          value={setEntry.reps || ""}
                          onChange={(event) =>
                            updateWorkoutSet(exercise.exerciseId, setEntry.setNumber, {
                              reps: Number(event.target.value || 0),
                            })
                          }
                          placeholder="Reps"
                          className="col-span-4 rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-1 text-white"
                        />
                      )}
                      <button
                        onClick={() =>
                          handleToggleSet(
                            exercise.exerciseId,
                            setEntry.setNumber,
                            exercise.restSeconds,
                            setEntry.completed,
                          )
                        }
                        className={`col-span-3 rounded-md px-2 py-1 font-semibold ${
                          setEntry.completed ? "bg-[#00E676] text-[#0D0D0F]" : "border border-[#2A2A30] text-[#8B8B95]"
                        }`}
                      >
                        {setEntry.completed ? "✓ Done" : "Mark"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

        {activeWorkout ? (
          <button
            onClick={handleFinishWorkout}
            className="w-full rounded-xl bg-[#6C5CE7] py-3 text-sm font-semibold text-white"
          >
            Finish Workout
          </button>
        ) : null}

        {summaryLog ? (
          <article className="rounded-2xl border border-[#FFD600]/50 bg-[#FFD600]/10 p-4">
            <h3 className="text-sm font-semibold text-[#FFD600]">Workout Complete</h3>
            <p className="text-sm text-white">Duration: {formatDuration(summaryLog.duration)}</p>
            <p className="text-sm text-white">Volume: {calculateWorkoutVolume(summaryLog)}</p>
            <p className="text-sm text-white">
              PRs hit: {summaryLog.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.isPR).length}
            </p>
          </article>
        ) : null}
      </div>
    );
  }

  function renderProgramView() {
    const phaseData = workoutPhases.find((entry) => entry.id === programPhaseView) ?? workoutPhases[0];
    const selectedDay = phaseData.days.find((entry) => entry.dayOfWeek === programDayView) ?? phaseData.days[0];
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto">
          {[1, 2, 3].map((id) => (
            <button
              key={id}
              onClick={() => setProgramView(id as 1 | 2 | 3, "monday")}
              className={`rounded-lg px-3 py-2 text-sm ${
                programPhaseView === id ? "bg-[#6C5CE7] text-white" : "border border-[#2A2A30] text-[#8B8B95]"
              }`}
            >
              Phase {id}
            </button>
          ))}
        </div>
        {programPhaseView > 1 ? (
          <article className="rounded-xl border border-[#6C5CE7]/50 bg-[#6C5CE7]/10 p-4">
            <h3 className="text-sm font-semibold text-[#C8C0FF]">What changes this phase</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#d8d0ff]">
              {phaseData.changesSummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {phaseData.days.map((day) => (
            <button
              key={day.dayOfWeek}
              onClick={() => setProgramView(programPhaseView, day.dayOfWeek)}
              className={`rounded-xl border p-3 text-left ${
                day.dayOfWeek === programDayView ? "border-[#6C5CE7] bg-[#6C5CE7]/15" : "border-[#2A2A30] bg-[#1A1A1F]"
              }`}
            >
              <p className="text-xs text-[#8B8B95]">{getDayName(day.dayOfWeek)}</p>
              <p className="text-sm font-semibold text-white">{day.name}</p>
            </button>
          ))}
        </div>
        <article className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
          <h3 className="text-lg font-semibold text-white">{selectedDay.name}</h3>
          <div className="mt-3 space-y-2">
            {selectedDay.exercises.map((exercise) => {
              const meta = exerciseById[exercise.exerciseId];
              if (!meta) return null;
              return (
                <div key={`${selectedDay.dayOfWeek}-${exercise.exerciseId}`} className="rounded-lg border border-[#2A2A30] bg-[#222228] p-3">
                  <p className="text-sm font-medium text-white">{meta.name}</p>
                  <p className="text-xs text-[#8B8B95]">
                    {exercise.sets} x {exercise.reps} - Rest {exercise.restSeconds}s
                    {exercise.supersetGroup ? ` - Superset ${exercise.supersetGroup}${exercise.supersetOrder ?? ""}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#8B8B95]">{exercise.phaseNotes ?? meta.notes}</p>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    );
  }

  function renderLogView() {
    const weeks = Array.from(new Set(workoutHistory.map((entry) => String(entry.weekNumber)))).sort();
    return (
      <div className="space-y-4">
        <Heatmap logs={workoutHistory} />
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "all" | "Push" | "Pull" | "Abs")}
            className="rounded-lg border border-[#2A2A30] bg-[#1A1A1F] px-3 py-2 text-sm text-white"
          >
            <option value="all">All workout types</option>
            <option value="Push">Push</option>
            <option value="Pull">Pull</option>
            <option value="Abs">Abs</option>
          </select>
          <select
            value={rangeFilter}
            onChange={(event) => setRangeFilter(event.target.value)}
            className="rounded-lg border border-[#2A2A30] bg-[#1A1A1F] px-3 py-2 text-sm text-white"
          >
            <option value="all">All weeks</option>
            {weeks.map((week) => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {filteredLogs.map((entry) => {
            const prs = entry.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.isPR).length;
            const expanded = expandedLog === entry.id;
            return (
              <article key={entry.id} className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
                <button onClick={() => setExpandedLog(expanded ? null : entry.id)} className="flex w-full items-center justify-between">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{entry.workoutDayName}</p>
                    <p className="text-xs text-[#8B8B95]">
                      {format(new Date(entry.date), "EEE, dd MMM")} - {formatDuration(entry.duration)}
                    </p>
                    <p className="text-xs text-[#8B8B95]">
                      Volume {calculateWorkoutVolume(entry)} - {entry.exercises.length} exercises
                    </p>
                  </div>
                  <span className="text-xs text-[#FFD600]">{prs > 0 ? `${prs} PR` : ""}</span>
                </button>
                {expanded ? (
                  <div className="mt-3 space-y-2">
                    {entry.exercises.map((exercise) => (
                      <div key={exercise.exerciseId} className="rounded-lg border border-[#2A2A30] bg-[#222228] p-2 text-xs">
                        <p className="font-medium text-white">{exerciseById[exercise.exerciseId]?.name ?? exercise.exerciseId}</p>
                        <p className="text-[#8B8B95]">
                          {exercise.sets.map((set) => `${set.setNumber}) ${set.weight}kg x ${set.reps}`).join(" | ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
          {!filteredLogs.length ? <p className="text-sm text-[#8B8B95]">No logs yet.</p> : null}
        </div>
      </div>
    );
  }

  function renderProgressView() {
    const workoutsCompleted = workoutHistory.length;
    const bodyWeightSeries = bodyWeightLog.map((entry) => ({ date: entry.date.slice(5), weight: entry.weight }));
    const milestoneRows = pullUpMilestones.map((milestone) => ({
      milestone,
      done: milestones[milestone],
    }));

    return (
      <div className="space-y-4">
        <section className="grid gap-3 md:grid-cols-5">
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
            <p className="text-xs text-[#8B8B95]">Total workouts</p>
            <p className="text-xl font-bold text-white">{workoutsCompleted}</p>
          </article>
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
            <p className="text-xs text-[#8B8B95]">Total volume</p>
            <p className="text-xl font-bold text-white">{totalVolume}</p>
          </article>
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
            <p className="text-xs text-[#8B8B95]">Longest streak</p>
            <p className="text-xl font-bold text-white">{longestStreak}</p>
          </article>
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
            <p className="text-xs text-[#8B8B95]">Current body weight</p>
            <p className="text-xl font-bold text-white">{currentWeight} kg</p>
          </article>
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-3">
            <p className="text-xs text-[#8B8B95]">Weight gained</p>
            <p className="text-xl font-bold text-white">{weightGain} kg</p>
          </article>
        </section>

        <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Body Weight Trend</h3>
            <input
              type="number"
              value={bodyWeightInput}
              onChange={(event) => setBodyWeightInput(event.target.value)}
              placeholder="Weekly weigh-in"
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-1 text-xs text-white"
            />
            <button
              onClick={() => {
                if (!bodyWeightInput) return;
                logBodyWeight(dateNowIso, Number(bodyWeightInput));
                setBodyWeightInput("");
              }}
              className="rounded-md bg-[#6C5CE7] px-3 py-1 text-xs font-semibold text-white"
            >
              Log Weight
            </button>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyWeightSeries}>
                <CartesianGrid stroke="#2A2A30" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#8B8B95" />
                <YAxis stroke="#8B8B95" />
                <Tooltip />
                <ReferenceLine y={67} stroke="#00E676" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#00E676" strokeDasharray="4 4" />
                <Line dataKey="weight" stroke="#6C5CE7" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <h3 className="text-sm font-semibold text-white">Strength Progress - Key Lifts</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={keyLiftProgress}>
                  <CartesianGrid stroke="#2A2A30" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#8B8B95" />
                  <YAxis stroke="#8B8B95" />
                  <Tooltip />
                  <Line type="monotone" dataKey="bench-press" stroke="#6C5CE7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lat-pulldown-wide" stroke="#448AFF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="db-rows" stroke="#00E676" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="db-curls" stroke="#FFD600" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Calisthenics Progress</h3>
              <button
                onClick={() => addCalisthenicsTest({ date: new Date().toISOString(), exercise: "pushups", value: 20 })}
                className="rounded-md border border-[#2A2A30] px-2 py-1 text-xs text-[#8B8B95]"
              >
                Log Test
              </button>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calisthenicsData}>
                  <CartesianGrid stroke="#2A2A30" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#8B8B95" />
                  <YAxis stroke="#8B8B95" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {calisthenicsData.map((entry, index) => (
                      <Cell key={`${entry.date}-${index}`} fill="#6C5CE7" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <h3 className="text-sm font-semibold text-white">Pull-Up Milestone Tracker</h3>
            <div className="mt-3 space-y-2">
              {milestoneRows.map((row) => (
                <button
                  key={row.milestone}
                  onClick={() => setMilestoneDate(row.milestone, row.done ? null : dateNowIso)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    row.done ? "border-[#00E676]/60 bg-[#00E676]/10 text-[#8DF3B8]" : "border-[#2A2A30] text-[#8B8B95]"
                  }`}
                >
                  <span>{row.milestone}</span>
                  <span>{row.done ? `✓ ${row.done}` : "Mark"}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <h3 className="text-sm font-semibold text-white">Weekly Volume + Consistency</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyVolume}>
                  <CartesianGrid stroke="#2A2A30" strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="#8B8B95" />
                  <YAxis stroke="#8B8B95" />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#448AFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <CircularProgress value={workoutHistory.length} target={plannedSessions} label="Sessions" unit="" color="#6C5CE7" />
              <div className="rounded-lg border border-[#2A2A30] bg-[#222228] p-3">
                <p className="text-xs text-[#8B8B95]">Consistency score</p>
                <p className="text-xl font-bold text-white">{consistencyScore}%</p>
                <p className="text-xs text-[#FF9100]">Current streak: {currentStreak} days</p>
              </div>
            </div>
          </article>
        </section>
      </div>
    );
  }

  function renderNutritionView() {
    const proteinTarget = 125;
    const calorieTarget = 2700;
    const weeklyAverage = Math.round(
      proteinWeekData.reduce((sum, day) => sum + day.protein, 0) / Math.max(1, proteinWeekData.length),
    );
    const creatineStreak = nutritionLogs
      .slice()
      .reverse()
      .reduce((count, day) => (day.creatineTaken ? count + 1 : count), 0);

    return (
      <div className="space-y-4">
        <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Daily Nutrition</h3>
            <input
              type="date"
              value={nutritionDate}
              onChange={(event) => setNutritionDate(event.target.value)}
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-1 text-xs text-white"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <CircularProgress value={nutritionTotals.protein} target={proteinTarget} label="Protein" unit="g" color="#00E676" />
            <CircularProgress value={nutritionTotals.calories} target={calorieTarget} label="Calories" unit="kcal" color="#6C5CE7" />
          </div>
        </article>

        <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
          <h3 className="text-sm font-semibold text-white">Add Meal</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <select
              value={mealForm.meal}
              onChange={(event) => setMealForm((prev) => ({ ...prev, meal: event.target.value as MealType }))}
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            >
              {mealOptions.map((meal) => (
                <option key={meal} value={meal}>
                  {meal}
                </option>
              ))}
            </select>
            <input
              value={mealForm.item}
              onChange={(event) => setMealForm((prev) => ({ ...prev, item: event.target.value }))}
              placeholder="Food item"
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            />
            <input
              type="number"
              value={mealForm.protein}
              onChange={(event) => setMealForm((prev) => ({ ...prev, protein: event.target.value }))}
              placeholder="Protein"
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            />
            <input
              type="number"
              value={mealForm.calories}
              onChange={(event) => setMealForm((prev) => ({ ...prev, calories: event.target.value }))}
              placeholder="Calories"
              className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            />
            <button
              onClick={() => {
                addMeal(
                  nutritionDate,
                  mealForm.meal,
                  mealForm.item || "Meal",
                  Number(mealForm.protein || 0),
                  Number(mealForm.calories || 0),
                );
                setMealForm({ meal: "Breakfast", item: "", protein: "", calories: "" });
              }}
              className="rounded-md bg-[#6C5CE7] px-3 py-2 text-sm font-semibold text-white"
            >
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickFoodPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => quickAddMeal(nutritionDate, preset.label, preset.protein, preset.calories)}
                className="rounded-full border border-[#2A2A30] bg-[#222228] px-3 py-1 text-xs text-[#8B8B95]"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {nutrition.meals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between rounded-lg border border-[#2A2A30] bg-[#222228] p-2">
                <div>
                  <p className="text-sm text-white">{meal.item}</p>
                  <p className="text-xs text-[#8B8B95]">
                    {meal.meal} - {meal.protein}g / {meal.calories} kcal
                  </p>
                </div>
                <button onClick={() => deleteMeal(nutritionDate, meal.id)} className="text-xs text-[#FF5252]">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </article>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <h3 className="text-sm font-semibold text-white">Weekly Protein Adherence</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proteinWeekData}>
                  <CartesianGrid stroke="#2A2A30" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#8B8B95" />
                  <YAxis stroke="#8B8B95" />
                  <Tooltip />
                  <Bar dataKey="protein" radius={[4, 4, 0, 0]}>
                    {proteinWeekData.map((day) => (
                      <Cell key={day.day} fill={day.protein >= 120 ? "#00E676" : "#FF5252"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-[#8B8B95]">Weekly average: {weeklyAverage}g protein</p>
          </article>

          <article className="rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-4">
            <h3 className="text-sm font-semibold text-white">Water + Creatine</h3>
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <button
                  key={`water-${index + 1}`}
                  onClick={() => setWaterGlasses(nutritionDate, index + 1)}
                  className={`h-8 w-8 rounded-md border ${
                    index < nutrition.waterGlasses
                      ? "border-[#448AFF] bg-[#448AFF]/30 text-[#8FB5FF]"
                      : "border-[#2A2A30] bg-[#222228] text-[#8B8B95]"
                  }`}
                >
                  💧
                </button>
              ))}
            </div>
            <button
              onClick={() => toggleCreatine(nutritionDate)}
              className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${
                nutrition.creatineTaken ? "bg-[#00E676] text-[#0D0D0F]" : "border border-[#2A2A30] text-[#8B8B95]"
              }`}
            >
              Creatine taken today {nutrition.creatineTaken ? "✓" : ""}
            </button>
            <p className="mt-2 text-xs text-[#8B8B95]">Creatine streak: {creatineStreak} days</p>
          </article>
        </section>
      </div>
    );
  }

  const modalExercise = showExerciseId ? exerciseById[showExerciseId] : null;
  const previousBest = showExerciseId
    ? workoutHistory
        .flatMap((entry) => entry.exercises.filter((exercise) => exercise.exerciseId === showExerciseId))
        .flatMap((exercise) => exercise.sets)
        .reduce(
          (best, set) => {
            const score = set.weight * set.reps;
            if (score > best.score) return { score, value: `${set.weight}kg x ${set.reps}` };
            return best;
          },
          { score: 0, value: "No previous best" },
        ).value
    : "No previous best";

  return (
    <section className="space-y-4 pb-16">
      <header className="rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-5">
        <p className="text-xs uppercase tracking-wide text-[#8B8B95]">12-Week Transformation Gym Tracker</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Health Module Rebuilt</h1>
        <p className="mt-2 text-sm text-[#8B8B95]">
          {athleteProfile.height} | Start {athleteProfile.startingWeightKg} kg | Goal {athleteProfile.goalWeightKg} kg
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <label className="text-xs text-[#8B8B95]">
            Program start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-[#8B8B95]">
            Current week override
            <input
              type="number"
              min={1}
              max={12}
              value={currentWeekOverride ?? ""}
              onChange={(event) => setCurrentWeekOverride(event.target.value ? Number(event.target.value) : null)}
              placeholder="Auto"
              className="mt-1 w-full rounded-md border border-[#2A2A30] bg-[#0D0D0F] px-2 py-2 text-sm text-white"
            />
          </label>
          <div className="rounded-md border border-[#2A2A30] bg-[#0D0D0F] p-2 text-xs text-[#8B8B95]">
            Auto week: {getCurrentWeek(startDate)} | Active week: {currentWeek}
            <br />
            Phase: {phase} | Diet: {athleteProfile.diet}
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-5 gap-2 rounded-xl border border-[#2A2A30] bg-[#1A1A1F] p-2">
        {tabOptions.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold md:text-sm ${
              selectedTab === tab.id ? "bg-[#6C5CE7] text-white" : "text-[#8B8B95]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {selectedTab === "today" ? renderTodayView() : null}
      {selectedTab === "program" ? renderProgramView() : null}
      {selectedTab === "log" ? renderLogView() : null}
      {selectedTab === "progress" ? renderProgressView() : null}
      {selectedTab === "nutrition" ? renderNutritionView() : null}

      {modalExercise ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onClick={() => setShowExerciseId(null)}>
          <article
            className="w-full max-w-md rounded-2xl border border-[#2A2A30] bg-[#1A1A1F] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{modalExercise.name}</h3>
            <p className="mt-1 text-xs text-[#8B8B95]">
              {modalExercise.muscleGroup} - {modalExercise.equipment}
            </p>
            <p className="mt-3 text-sm text-[#8B8B95]">{modalExercise.notes}</p>
            <p className="mt-2 text-sm text-[#8B8B95]">Cue: {modalExercise.formTip}</p>
            <p className="mt-2 text-sm text-[#FFD600]">Previous best: {previousBest}</p>
            <button
              onClick={() => setShowExerciseId(null)}
              className="mt-4 w-full rounded-lg bg-[#6C5CE7] py-2 text-sm font-semibold text-white"
            >
              Close
            </button>
          </article>
        </div>
      ) : null}
    </section>
  );
}
