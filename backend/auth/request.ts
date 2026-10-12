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

export function apiError(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
