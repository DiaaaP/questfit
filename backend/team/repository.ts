import { env } from "cloudflare:workers";
import type { TeamData, TeamMember } from "@/shared/questfit";

export class TeamError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function getTeamForUser(userId: number): Promise<TeamData | null> {
  const team = await database()
    .prepare(
      `SELECT t.id, t.name, t.invite_code AS code, t.goal_km AS goalKm,
              t.leader_user_id AS leaderId
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ? LIMIT 1`,
    )
    .bind(userId)
    .first<{ id: number; name: string; code: string; goalKm: number; leaderId: number }>();
  if (!team) return null;

  const result = await database()
    .prepare(
      `SELECT u.id AS userId, u.full_name AS name, tm.role, tm.joined_at AS joinedAt,
              COALESCE(SUM(tc.distance_meters), 0) AS distanceMeters,
              COALESCE(SUM(tc.xp), 0) AS xp
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN team_contributions tc
         ON tc.team_id = tm.team_id AND tc.user_id = tm.user_id
       WHERE tm.team_id = ?
       GROUP BY u.id, u.full_name, tm.role, tm.joined_at
       ORDER BY CASE WHEN tm.role = 'leader' THEN 0 ELSE 1 END, distanceMeters DESC`,
    )
    .bind(team.id)
    .all<{ userId: number; name: string; role: "leader" | "member"; joinedAt: number; distanceMeters: number; xp: number }>();

  const members: TeamMember[] = result.results.map((member) => ({
    userId: Number(member.userId),
    name: member.name,
    role: member.role,
    contributionKm: Math.round((Number(member.distanceMeters) / 1000) * 10) / 10,
    xp: Number(member.xp),
    joinedAt: Number(member.joinedAt),
  }));

  return {
    id: Number(team.id),
    name: team.name,
    code: team.code,
    goalKm: Number(team.goalKm),
    totalKm: Math.round(members.reduce((sum, member) => sum + member.contributionKm, 0) * 10) / 10,
    leaderId: Number(team.leaderId),
    members,
  };
}

export async function createTeam(userId: number, name: string, goalKm: number) {
  if (await getTeamForUser(userId)) throw new TeamError("Сначала выйдите из текущей команды.", 409);
  const code = createInviteCode();
  const now = Date.now();
  await database().batch([
    database().prepare("INSERT INTO teams (name, invite_code, goal_km, leader_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(name, code, goalKm, userId, now),
    database().prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) SELECT id, ?, 'leader', ? FROM teams WHERE invite_code = ?")
      .bind(userId, now, code),
  ]);
  return getTeamForUser(userId);
}

export async function joinTeam(userId: number, inviteCode: string) {
  if (await getTeamForUser(userId)) throw new TeamError("Вы уже состоите в команде.", 409);
  const team = await database()
    .prepare("SELECT id FROM teams WHERE invite_code = ? LIMIT 1")
    .bind(inviteCode.trim().toUpperCase())
    .first<{ id: number }>();
  if (!team) throw new TeamError("Команда с таким кодом не найдена.", 404);
  await database()
    .prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)")
    .bind(team.id, userId, Date.now())
    .run();
  return getTeamForUser(userId);
}

export async function contributeToTeam(userId: number, distanceKm: number) {
  const team = await getTeamForUser(userId);
  if (!team) throw new TeamError("Сначала вступите в команду.", 404);
  const xp = Math.round(distanceKm * 40);
  await database()
    .prepare("INSERT INTO team_contributions (team_id, user_id, distance_meters, xp, contributed_at) VALUES (?, ?, ?, ?, ?)")
    .bind(team.id, userId, Math.round(distanceKm * 1000), xp, Date.now())
    .run();
  return getTeamForUser(userId);
}

export async function leaveTeam(userId: number) {
  const team = await getTeamForUser(userId);
  if (!team) throw new TeamError("Вы не состоите в команде.", 404);
  if (team.leaderId !== userId) {
    await database().prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").bind(team.id, userId).run();
    return null;
  }

  const successor = team.members.find((member) => member.userId !== userId);
  if (!successor) {
    await database().prepare("DELETE FROM teams WHERE id = ?").bind(team.id).run();
    return null;
  }
  await database().batch([
    database().prepare("UPDATE teams SET leader_user_id = ? WHERE id = ?").bind(successor.userId, team.id),
    database().prepare("UPDATE team_members SET role = 'leader' WHERE team_id = ? AND user_id = ?").bind(team.id, successor.userId),
    database().prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").bind(team.id, userId),
  ]);
  return null;
}

export async function kickTeamMember(userId: number, targetUserId: number) {
  const team = await getTeamForUser(userId);
  if (!team || team.leaderId !== userId) throw new TeamError("Только лидер может исключать участников.", 403);
  if (targetUserId === userId) throw new TeamError("Для выхода используйте отдельную кнопку.");
  const target = team.members.find((member) => member.userId === targetUserId);
  if (!target) throw new TeamError("Участник не найден.", 404);
  await database().prepare(
    "DELETE FROM team_members WHERE team_id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM teams WHERE id = ? AND leader_user_id = ?)",
  ).bind(team.id, targetUserId, team.id, userId).run();
  return getTeamForUser(userId);
}

export async function transferTeamLeadership(userId: number, targetUserId: number) {
  const team = await getTeamForUser(userId);
  if (!team || team.leaderId !== userId) throw new TeamError("Только лидер может передать управление.", 403);
  if (targetUserId === userId || !team.members.some((member) => member.userId === targetUserId)) {
    throw new TeamError("Выберите другого участника команды.", 400);
  }
  const result = await database().batch([
    database().prepare(
      `UPDATE teams SET leader_user_id = ? WHERE id = ? AND leader_user_id = ?
       AND EXISTS (SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?)`,
    ).bind(targetUserId, team.id, userId, team.id, targetUserId),
    database().prepare(
      `UPDATE team_members SET role = CASE WHEN user_id = ? THEN 'leader' ELSE 'member' END
       WHERE team_id = ? AND EXISTS (SELECT 1 FROM teams WHERE id = ? AND leader_user_id = ?)`,
    ).bind(targetUserId, team.id, team.id, targetUserId),
  ]);
  if (!result[0].meta.changes) throw new TeamError("Состав изменился. Обновите страницу.", 409);
  return getTeamForUser(userId);
}
