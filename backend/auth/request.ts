import { getSessionUser } from "./service";

export async function requireSessionUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Войдите, чтобы продолжить." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireAdminUser(request: Request) {
  const user = await requireSessionUser(request);
  if (user.id !== 1) {
    throw new Response(JSON.stringify({ error: "Админ-панель доступна владельцу проекта." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
