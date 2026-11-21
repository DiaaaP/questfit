import { env } from "cloudflare:workers";
import type { AdminData, AdminEvent, AdminQuest, AdminUser } from "@/shared/questfit";

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

export async function getAdminData(): Promise<AdminData> {
  const [usersResult, questsResult, eventsResult] = await Promise.all([
    database().prepare(
      `SELECT u.id, u.full_name AS fullName, u.email, u.goal, u.created_at AS createdAt,
              COUNT(DISTINCT wl.id) AS workoutCount, MAX(t.name) AS teamName
       FROM users u
       LEFT JOIN workout_logs wl ON wl.user_id = u.id
       LEFT JOIN team_members tm ON tm.user_id = u.id
       LEFT JOIN teams t ON t.id = tm.team_id
       GROUP BY u.id, u.full_name, u.email, u.goal, u.created_at
       ORDER BY u.created_at DESC LIMIT 100`,
    ).all<AdminUser>(),
    database().prepare(
      `SELECT id, title, detail, xp, active
       FROM quest_definitions ORDER BY created_at DESC`,
    ).all<{ id: number; title: string; detail: string; xp: number; active: number }>(),
    database().prepare(
      `SELECT e.id, e.slug, e.title, e.location, e.distance_meters AS distanceMeters,
              e.start_at AS startAt, e.reward_xp AS rewardXp, e.capacity, e.active,
              COUNT(er.user_id) AS registrations
       FROM events e
       LEFT JOIN event_registrations er ON er.event_slug = e.slug
       GROUP BY e.id ORDER BY e.start_at ASC`,
    ).all<{ id: number; slug: string; title: string; location: string; distanceMeters: number; startAt: number; rewardXp: number; capacity: number; active: number; registrations: number }>(),
  ]);

  const users = usersResult.results.map((user) => ({
    ...user,
    id: Number(user.id),
    createdAt: Number(user.createdAt),
    workoutCount: Number(user.workoutCount),
    teamName: user.teamName ?? null,
  }));
  const quests: AdminQuest[] = questsResult.results.map((quest) => ({
    ...quest,
    id: Number(quest.id),
    xp: Number(quest.xp),
    active: Boolean(quest.active),
  }));
  const events: AdminEvent[] = eventsResult.results.map((event) => ({
    id: Number(event.id),
    slug: event.slug,
    title: event.title,
    location: event.location,
    distanceKm: Number(event.distanceMeters) / 1000,
    startAt: Number(event.startAt),
    rewardXp: Number(event.rewardXp),
    capacity: Number(event.capacity),
    active: Boolean(event.active),
    registrations: Number(event.registrations),
  }));
  return { users, quests, events };
}

export async function createQuest(input: Omit<AdminQuest, "id">) {
  await database()
    .prepare("INSERT INTO quest_definitions (title, detail, xp, active, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(input.title, input.detail, input.xp, input.active ? 1 : 0, Date.now())
    .run();
}

export async function updateQuest(input: AdminQuest) {
  await database()
    .prepare("UPDATE quest_definitions SET title = ?, detail = ?, xp = ?, active = ? WHERE id = ?")
    .bind(input.title, input.detail, input.xp, input.active ? 1 : 0, input.id)
    .run();
}

export async function deleteQuest(id: number) {
  await database().prepare("DELETE FROM quest_definitions WHERE id = ?").bind(id).run();
}

export async function createEvent(input: Omit<AdminEvent, "id" | "registrations">) {
  await database()
    .prepare(
      `INSERT INTO events
       (slug, title, location, distance_meters, start_at, reward_xp, capacity, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.slug, input.title, input.location, Math.round(input.distanceKm * 1000), input.startAt, input.rewardXp, input.capacity, input.active ? 1 : 0, Date.now())
    .run();
}

export async function updateEvent(input: Omit<AdminEvent, "registrations">) {
  await database()
    .prepare(
      `UPDATE events SET title = ?, location = ?, distance_meters = ?,
       start_at = ?, reward_xp = ?, capacity = ?, active = ? WHERE id = ?`,
    )
    .bind(input.title, input.location, Math.round(input.distanceKm * 1000), input.startAt, input.rewardXp, input.capacity, input.active ? 1 : 0, input.id)
    .run();
}

export async function deleteEvent(id: number) {
  const db = database();
  await db.batch([
    db.prepare("DELETE FROM event_registrations WHERE event_slug = (SELECT slug FROM events WHERE id = ?)").bind(id),
    db.prepare("DELETE FROM events WHERE id = ?").bind(id),
  ]);
}
