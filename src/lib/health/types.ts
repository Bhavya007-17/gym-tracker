export type ExerciseType = "bodyweight" | "weighted" | "machine" | "timed";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "abs"
  | "full_body";

export type WeekdayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: MuscleGroup;
  equipment: string;
  notes: string;
  supersetPair?: string;
  isTimeBased: boolean;
  formTip: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  supersetGroup?: string;
  supersetOrder?: 1 | 2;
  sets: number;
  reps: string;
  restSeconds: number;
  isDropSet?: boolean;
  isBurnout?: boolean;
  phaseNotes?: string;
}

export interface WorkoutDay {
  dayOfWeek: WeekdayKey;
  name: string;
  focus: "Push" | "Pull" | "Abs";
  exercises: WorkoutExercise[];
}

export interface WorkoutPhase {
  id: number;
  label: string;
  weeks: [number, number];
  changesSummary: string[];
  days: WorkoutDay[];
}

export interface LoggedSet {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
  isPR: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutLog {
  id: string;
  date: string;
  workoutDayName: string;
  weekNumber: number;
  phase: number;
  duration: number;
  exercises: LoggedExercise[];
}

export interface ActiveWorkoutExercise {
  exerciseId: string;
  sets: LoggedSet[];
  startedAt?: string;
  elapsedSeconds?: number;
}

export interface ActiveWorkout {
  startedAt: string;
  weekNumber: number;
  phase: number;
  dayOfWeek: WeekdayKey;
  workoutName: string;
  exercises: ActiveWorkoutExercise[];
}

export interface BodyWeightEntry {
  date: string;
  weight: number;
}

export type MealType =
  | "Breakfast"
  | "Snack"
  | "Lunch"
  | "Pre-Workout"
  | "Post-Workout Shake"
  | "Dinner"
  | "Before Bed";

export interface MealEntry {
  id: string;
  meal: MealType;
  item: string;
  protein: number;
  calories: number;
}

export interface DailyNutrition {
  date: string;
  meals: MealEntry[];
  waterGlasses: number;
  creatineTaken: boolean;
}

export interface CalisthenicsTest {
  date: string;
  exercise: "pushups" | "pullups" | "plank" | "hangingLegRaises";
  value: number;
}

export interface AppState {
  currentWeekOverride: number | null;
  startDate: string;
  bodyWeightLog: BodyWeightEntry[];
  activeWorkout: ActiveWorkout | null;
  workoutHistory: WorkoutLog[];
  nutritionLogs: DailyNutrition[];
  pullUpMilestones: Record<string, string | null>;
  calisthenicsTests: CalisthenicsTest[];
  currentStreak: number;
  longestStreak: number;
}
