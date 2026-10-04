import { AuthError, loginAccount, sessionCookie } from "@/backend/auth/service";

export async function POST(request: Request) {
  try {
    const { user, token } = await loginAccount(await request.json());
    return Response.json(
      { user },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("QuestFit login failed", error);
    return Response.json({ error: "Не удалось войти. Попробуйте ещё раз." }, { status: 500 });
  }
}
