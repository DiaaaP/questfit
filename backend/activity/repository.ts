import { env } from "cloudflare:workers";
import { featuredEventSlug, starterEvents } from "@/shared/catalog";

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
      .prepare("SELECT event_slug AS eventSlug FROM event_registrations WHERE user_id = ?")
      .bind(userId)
      .all<{ eventSlug: string }>(),
  ]);

  const registeredEventSlugs = eventResult.results.map(({ eventSlug }) => eventSlug);
  return {
    completedQuestIds: questsResult.results.map((row) => Number(row.questId)),
    registeredEventSlugs,
    registeredForEvent: registeredEventSlugs.includes(featuredEventSlug),
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

export async function setEventRegistration(userId: number, registered: boolean, slug = featuredEventSlug) {
  if (!registered) {
    await database()
      .prepare("DELETE FROM event_registrations WHERE user_id = ? AND event_slug = ?")
      .bind(userId, slug)
      .run();
    return true;
  }
  const starter = starterEvents.find((event) => event.slug === slug);
  const now = Date.now();
  const result = await database().prepare(
    `INSERT OR IGNORE INTO event_registrations (user_id, event_slug, registered_at)
     SELECT ?, ?, ?
     WHERE (SELECT COUNT(*) FROM event_registrations WHERE event_slug = ?) <
       COALESCE(
         (SELECT CASE WHEN active = 1 AND start_at > ? THEN capacity ELSE 0 END FROM events WHERE slug = ?),
         ?
       )`,
  ).bind(userId, slug, now, slug, now, slug, starter && starter.startAt > now ? starter.capacity : 0).run();
  if (result.meta.changes > 0) return true;
  return Boolean(await database().prepare("SELECT 1 FROM event_registrations WHERE user_id = ? AND event_slug = ?")
    .bind(userId, slug).first());
}
