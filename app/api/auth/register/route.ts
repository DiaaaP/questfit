import { AuthError, registerAccount, sessionCookie } from "@/backend/auth/service";

export async function POST(request: Request) {
  try {
    const { user, token } = await registerAccount(await request.json());
    return Response.json(
      { user },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("QuestFit registration failed", error);
    return Response.json(
      { error: "Не удалось создать аккаунт. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}
