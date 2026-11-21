import { env } from "cloudflare:workers";
import { questPeriod, summarizeActivity, type DailyCompletion, type EventFinish } from "@/shared/activity";
import { customQuestOffset, dailyQuests, featuredEventSlug, starterEvents } from "@/shared/catalog";

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

export async function getRegisteredEventSlugs(userId: number) {
  const result = await database()
    .prepare(
      `SELECT r.event_slug AS slug FROM event_registrations r
       WHERE r.user_id = ? AND (r.event_slug = ? OR EXISTS (SELECT 1 FROM events WHERE slug = r.event_slug))`,
    )
    .bind(userId, featuredEventSlug)
    .all<{ slug: string }>();
  return result.results.map(({ slug }) => slug);
}

export async function getActivity(userId: number) {
  const period = questPeriod();
  const db = database();
  const [daily, legacy, registered, finishes] = await Promise.all([
    db.prepare("SELECT quest_id AS questId, day, xp FROM daily_quest_completions WHERE user_id = ?")
      .bind(userId).all<DailyCompletion>(),
    db.prepare(
      `SELECT p.quest_id AS questId, p.completed_at AS completedAt, q.xp AS customXp
       FROM quest_progress p LEFT JOIN quest_definitions q ON q.id = p.quest_id - ?
       WHERE p.user_id = ?`,
    ).bind(customQuestOffset, userId).all<{ questId: number; completedAt: number; customXp: number | null }>(),
    getRegisteredEventSlugs(userId),
    db.prepare("SELECT event_slug AS slug, xp, finished_at AS finishedAt FROM event_finishes WHERE user_id = ?")
      .bind(userId).all<EventFinish>(),
  ]);
  const keys = new Set(daily.results.map(({ questId, day }) => day + ":" + questId));
  const pastCompletions = legacy.results.flatMap(({ questId, completedAt, customXp }) => {
    const { day } = questPeriod(completedAt);
    const xp = dailyQuests.find((quest) => quest.id === questId)?.xp ?? customXp ?? 0;
    return keys.has(day + ":" + questId) ? [] : [{ questId, day, xp }];
  });
  return summarizeActivity([...pastCompletions, ...daily.results], registered, finishes.results, period.day);
}

export async function setQuestCompletion(userId: number, questId: number, xp: number | null) {
  const period = questPeriod();
  const db = database();
  if (xp !== null) {
    await db.prepare(
      `INSERT OR IGNORE INTO daily_quest_completions (user_id, quest_id, day, xp)
       SELECT ?, ?, ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM quest_progress WHERE user_id = ? AND quest_id = ? AND completed_at >= ? AND completed_at < ?
       )`,
    ).bind(userId, questId, period.day, xp, userId, questId, period.startsAt, period.endsAt).run();
    return;
  }
  await db.batch([
    db.prepare("DELETE FROM daily_quest_completions WHERE user_id = ? AND quest_id = ? AND day = ?")
      .bind(userId, questId, period.day),
    db.prepare("DELETE FROM quest_progress WHERE user_id = ? AND quest_id = ? AND completed_at >= ? AND completed_at < ?")
      .bind(userId, questId, period.startsAt, period.endsAt),
  ]);
}

export async function setEventRegistration(userId: number, registered: boolean, slug = featuredEventSlug) {
  const db = database();
  if (!registered) {
    const result = await db.prepare(
      `DELETE FROM event_registrations WHERE user_id = ? AND event_slug = ?
       AND NOT EXISTS (SELECT 1 FROM event_finishes WHERE user_id = ? AND event_slug = ?)`,
    ).bind(userId, slug, userId, slug).run();
    return result.meta.changes > 0 || !await db.prepare("SELECT 1 FROM event_finishes WHERE user_id = ? AND event_slug = ?")
      .bind(userId, slug).first();
  }
  const starter = starterEvents.find((event) => event.slug === slug);
  const now = Date.now();
  const result = await db.prepare(
    `INSERT OR IGNORE INTO event_registrations (user_id, event_slug, registered_at)
     SELECT ?, ?, ?
     WHERE (SELECT COUNT(*) FROM event_registrations WHERE event_slug = ?) <
       COALESCE(
         (SELECT CASE WHEN active = 1 AND start_at > ? THEN capacity ELSE 0 END FROM events WHERE slug = ?),
         ?
       )`,
  ).bind(userId, slug, now, slug, now, slug, starter && starter.startAt > now ? starter.capacity : 0).run();
  if (result.meta.changes > 0) return true;
  return Boolean(await db.prepare("SELECT 1 FROM event_registrations WHERE user_id = ? AND event_slug = ?")
    .bind(userId, slug).first());
}

export async function finishEvent(userId: number, slug: string) {
  const db = database();
  const starter = starterEvents.find((event) => event.slug === slug);
  const now = Date.now();
  await db.prepare(
    `INSERT OR IGNORE INTO event_finishes (user_id, event_slug, xp, finished_at)
     SELECT r.user_id, r.event_slug, e.xp, ?
     FROM event_registrations r
     CROSS JOIN (
       SELECT reward_xp AS xp, start_at FROM events WHERE slug = ?
       UNION ALL SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM events WHERE slug = ?)
     ) e
     WHERE r.user_id = ? AND r.event_slug = ? AND e.start_at <= ? AND e.xp > 0`,
  ).bind(now, slug, starter?.rewardXp ?? null, starter?.startAt ?? null, slug, userId, slug, now).run();
  return Boolean(await db.prepare("SELECT 1 FROM event_finishes WHERE user_id = ? AND event_slug = ?")
    .bind(userId, slug).first());
}
