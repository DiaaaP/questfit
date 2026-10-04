import {
  createRandomToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "./crypto";
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  findUserBySession,
  type PublicUser,
} from "./repository";

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerAccount(payload: unknown) {
  const input = (payload ?? {}) as Record<string, unknown>;
  const fullName = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  const email = normalizeEmail(String(input.email ?? ""));
  const password = String(input.password ?? "");
  const goal = String(input.goal ?? "Баланс и выносливость").trim();

  if (fullName.length < 2 || fullName.length > 60) {
    throw new AuthError("Укажите имя от 2 до 60 символов.");
  }
  if (!validateEmail(email) || email.length > 160) {
    throw new AuthError("Проверьте адрес электронной почты.");
  }
  if (password.length < 8 || password.length > 128) {
    throw new AuthError("Пароль должен содержать не меньше 8 символов.");
  }
  if (await findUserByEmail(email)) {
    throw new AuthError("Аккаунт с такой почтой уже существует.", 409);
  }

  const passwordData = await hashPassword(password);
  let id: number;
  try {
    id = await createUser({
      fullName,
      email,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      goal: goal.slice(0, 80) || "Баланс и выносливость",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new AuthError("Аккаунт с такой почтой уже существует.", 409);
    }
    throw error;
  }

  return issueSession({ id, fullName, email, goal: goal || "Баланс и выносливость" });
}

export async function loginAccount(payload: unknown) {
  const input = (payload ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(String(input.email ?? ""));
  const password = String(input.password ?? "");
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
    throw new AuthError("Неверная почта или пароль.", 401);
  }
  return issueSession({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    goal: user.goal,
  });
}

async function issueSession(user: PublicUser) {
  const token = createRandomToken();
  const tokenHash = await hashSessionToken(token);
  await createSession(user.id, tokenHash, Date.now() + SESSION_SECONDS * 1000);
  return { user, token };
}

export function sessionCookie(token: string) {
  return `qf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return "qf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("qf_session="));
  return value ? value.slice("qf_session=".length) : null;
}

export async function getSessionUser(request: Request) {
  const token = readSessionToken(request);
  return token ? findUserBySession(await hashSessionToken(token)) : null;
}

export async function logoutAccount(request: Request) {
  const token = readSessionToken(request);
  if (token) await deleteSession(await hashSessionToken(token));
}
