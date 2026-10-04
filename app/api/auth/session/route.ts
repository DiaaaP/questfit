import { getSessionUser } from "@/backend/auth/service";

export async function GET(request: Request) {
  try {
    return Response.json({ user: await getSessionUser(request) });
  } catch (error) {
    console.error("QuestFit session lookup failed", error);
    return Response.json({ user: null });
  }
}
