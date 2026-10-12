import { getPreferences } from "@/backend/profile/repository";
import { listWorkouts } from "@/backend/workouts/repository";
import { buildDashboard } from "@/shared/questfit";

export async function getDashboard(userId: number, displayName: string) {
  const [workouts, preferences] = await Promise.all([
    listWorkouts(userId),
    getPreferences(userId),
  ]);
  return buildDashboard(workouts, preferences, displayName);
}
