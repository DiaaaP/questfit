import { env } from "cloudflare:workers";
import type { NewWorkoutInput, WorkoutEntry, WorkoutType } from "@/shared/questfit";
import { calculateWorkoutXp } from "@/shared/questfit";

type WorkoutRow = {
  id: number;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  distanceMeters: number;
  calories: number;
  xp: number;
  performedAt: number;
  notes: string;
};

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

function mapWorkout(row: WorkoutRow): WorkoutEntry {
  return {
    id: Number(row.id),
    title: row.title,
    type: row.type,
    durationMinutes: Number(row.durationMinutes),
    distanceKm: Number(row.distanceMeters) / 1000,
    calories: Number(row.calories),
    xp: Number(row.xp),
    performedAt: Number(row.performedAt),
    notes: row.notes,
  };
}

export async function listWorkouts(userId: number) {
  const result = await database()
    .prepare(
      `SELECT id, title, activity_type AS type, duration_minutes AS durationMinutes,
              distance_meters AS distanceMeters, calories, xp,
              performed_at AS performedAt, notes
       FROM workout_logs
       WHERE user_id = ?
       ORDER BY performed_at DESC, id DESC`,
    )
    .bind(userId)
    .all<WorkoutRow>();
  return result.results.map(mapWorkout);
}

export async function createWorkout(userId: number, input: NewWorkoutInput) {
  const xp = calculateWorkoutXp(input);
  const result = await database()
    .prepare(
      `INSERT INTO workout_logs
       (user_id, title, activity_type, duration_minutes, distance_meters, calories, xp, performed_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      input.title,
      input.type,
      input.durationMinutes,
      Math.round(input.distanceKm * 1000),
      input.calories,
      xp,
      input.performedAt,
      input.notes,
      Date.now(),
    )
    .run();

  return {
    id: Number(result.meta.last_row_id),
    ...input,
    xp,
  } satisfies WorkoutEntry;
}

export async function deleteWorkout(userId: number, workoutId: number) {
  const result = await database()
    .prepare("DELETE FROM workout_logs WHERE id = ? AND user_id = ?")
    .bind(workoutId, userId)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}
