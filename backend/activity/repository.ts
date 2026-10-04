import { env } from "cloudflare:workers";

const EVENT_SLUG = "night-run-ural";

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

export async function getActivity(userId: number) {
  const [questsResult, eventResult] = await Promise.all([
    database()
      .prepare("SELECT quest_id AS questId FROM quest_progress WHERE user_id = ? ORDER BY quest_id")
      .bind(userId)
      .all<{ questId: number }>(),
    database()
      .prepare("SELECT event_slug AS eventSlug FROM event_registrations WHERE user_id = ? AND event_slug = ? LIMIT 1")
      .bind(userId, EVENT_SLUG)
      .first<{ eventSlug: string }>(),
  ]);

  return {
    completedQuestIds: questsResult.results.map((row) => Number(row.questId)),
    registeredForEvent: Boolean(eventResult),
  };
}

export async function setQuestCompletion(userId: number, questId: number, completed: boolean) {
  if (completed) {
    await database()
      .prepare("INSERT OR REPLACE INTO quest_progress (user_id, quest_id, completed_at) VALUES (?, ?, ?)")
      .bind(userId, questId, Date.now())
      .run();
  } else {
    await database()
      .prepare("DELETE FROM quest_progress WHERE user_id = ? AND quest_id = ?")
      .bind(userId, questId)
      .run();
  }
}

export async function setEventRegistration(userId: number, registered: boolean) {
  if (registered) {
    await database()
      .prepare("INSERT OR REPLACE INTO event_registrations (user_id, event_slug, registered_at) VALUES (?, ?, ?)")
      .bind(userId, EVENT_SLUG, Date.now())
      .run();
  } else {
    await database()
      .prepare("DELETE FROM event_registrations WHERE user_id = ? AND event_slug = ?")
      .bind(userId, EVENT_SLUG)
      .run();
  }
}
