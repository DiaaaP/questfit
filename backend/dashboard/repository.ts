import { env } from "cloudflare:workers";
import { getPreferences } from "@/backend/profile/repository";
import { listWorkouts } from "@/backend/workouts/repository";
import { buildDashboard, defaultPreferences } from "@/shared/questfit";

export async function getDashboard(userId: number, displayName: string) {
  const db = env.DB;
  if (!db) throw new Error("QuestFit database is unavailable");
  const [workouts, preferences] = await Promise.all([
    listWorkouts(userId),
    getPreferences(userId),
  ]);
  const result = await db.prepare(
    `SELECT u.id, u.full_name AS name, COALESCE(SUM(w.xp), 0) AS xp
     FROM users u
     LEFT JOIN user_preferences p ON p.user_id = u.id
     LEFT JOIN workout_logs w ON w.user_id = u.id
     WHERE COALESCE(p.city, ?) = ? COLLATE NOCASE
     GROUP BY u.id, u.full_name ORDER BY xp DESC, u.id LIMIT 20`,
  ).bind(defaultPreferences.city, preferences.city).all<{ id: number; name: string; xp: number }>();
  return {
    ...buildDashboard(workouts, preferences, displayName),
    leaderboard: result.results.map(({ id, name, xp }, index) => {
      const [firstName, lastName] = name.trim().split(/\s+/);
      return {
        position: index + 1,
        name: lastName ? `${firstName} ${lastName[0]}.` : firstName,
        xp: Number(xp),
        accent: name.slice(0, 2).toUpperCase(),
        currentUser: id === userId,
      };
    }),
  };
}
