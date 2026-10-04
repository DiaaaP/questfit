import { clearSessionCookie, logoutAccount } from "@/backend/auth/service";

export async function POST(request: Request) {
  try {
    await logoutAccount(request);
  } catch (error) {
    console.error("QuestFit logout failed", error);
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
