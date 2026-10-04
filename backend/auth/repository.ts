import { env } from "cloudflare:workers";

export type PublicUser = {
  id: number;
  fullName: string;
  email: string;
  goal: string;
};

export type StoredUser = PublicUser & {
  passwordHash: string;
  passwordSalt: string;
};

function database() {
  if (!env.DB) throw new Error("QuestFit database is unavailable");
  return env.DB;
}

export async function findUserByEmail(email: string) {
  return database()
    .prepare(
      `SELECT id, full_name AS fullName, email, goal,
              password_hash AS passwordHash, password_salt AS passwordSalt
       FROM users WHERE email = ? LIMIT 1`,
    )
    .bind(email)
    .first<StoredUser>();
}

export async function createUser(input: {
  fullName: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  goal: string;
}) {
  const result = await database()
    .prepare(
      `INSERT INTO users (full_name, email, password_hash, password_salt, goal, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.fullName,
      input.email,
      input.passwordHash,
      input.passwordSalt,
      input.goal,
      Date.now(),
    )
    .run();
  return Number(result.meta.last_row_id);
}

export async function createSession(userId: number, tokenHash: string, expiresAt: number) {
  await database()
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(tokenHash, userId, expiresAt, Date.now())
    .run();
}

export async function findUserBySession(tokenHash: string) {
  return database()
    .prepare(
      `SELECT u.id, u.full_name AS fullName, u.email, u.goal
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<PublicUser>();
}

export async function deleteSession(tokenHash: string) {
  await database().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
