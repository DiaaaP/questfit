import { env } from "cloudflare:workers";
import type { ProfilePreferences } from "@/shared/questfit";
import { defaultPreferences } from "@/shared/questfit";

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

export async function getPreferences(userId: number): Promise<ProfilePreferences> {
  const preferences = await database()
    .prepare(
      `SELECT weekly_goal_minutes AS weeklyGoalMinutes, city,
              notifications_enabled AS notificationsEnabled
       FROM user_preferences WHERE user_id = ? LIMIT 1`,
    )
    .bind(userId)
    .first<{ weeklyGoalMinutes: number; city: string; notificationsEnabled: number }>();

  return preferences
    ? {
        weeklyGoalMinutes: Number(preferences.weeklyGoalMinutes),
        city: preferences.city,
        notificationsEnabled: Boolean(preferences.notificationsEnabled),
      }
    : defaultPreferences;
}

export async function updateProfile(
  userId: number,
  input: { fullName: string; goal: string } & ProfilePreferences,
) {
  const now = Date.now();
  await database().batch([
    database()
      .prepare("UPDATE users SET full_name = ?, goal = ? WHERE id = ?")
      .bind(input.fullName, input.goal, userId),
    database()
      .prepare(
        `INSERT INTO user_preferences
         (user_id, weekly_goal_minutes, city, notifications_enabled, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           weekly_goal_minutes = excluded.weekly_goal_minutes,
           city = excluded.city,
           notifications_enabled = excluded.notifications_enabled,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, input.weeklyGoalMinutes, input.city, input.notificationsEnabled ? 1 : 0, now),
  ]);
  return getPreferences(userId);
}
