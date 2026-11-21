import { env } from "cloudflare:workers";
import { catalogEvents, catalogQuests } from "@/shared/catalog";
import type { AdminEvent, AdminQuest } from "@/shared/questfit";

export async function getCatalog() {
  const db = env.DB;
  if (!db) throw new Error("QuestFit database is unavailable");
  const [quests, events, counts] = await Promise.all([
    db.prepare("SELECT id, title, detail, xp, active FROM quest_definitions ORDER BY id").all<AdminQuest>(),
    db.prepare(
      `SELECT id, slug, title, location, distance_meters / 1000.0 AS distanceKm,
       start_at AS startAt, reward_xp AS rewardXp, capacity, active
       FROM events ORDER BY start_at`,
    ).all<AdminEvent>(),
    db.prepare("SELECT event_slug AS slug, COUNT(*) AS total FROM event_registrations GROUP BY event_slug")
      .all<{ slug: string; total: number }>(),
  ]);
  const registrations = new Map(counts.results.map(({ slug, total }) => [slug, total]));
  return {
    quests: catalogQuests(quests.results),
    events: catalogEvents(events.results).map((event) => ({
      ...event, active: Boolean(event.active), registrations: registrations.get(event.slug) ?? 0,
    })),
  };
}
