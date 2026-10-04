import { getActivity, setEventRegistration, setQuestCompletion } from "@/backend/activity/repository";
import { getSessionUser } from "@/backend/auth/service";

async function requireUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "Войдите, чтобы сохранить прогресс." }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return Response.json(await getActivity(user.id));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("QuestFit activity lookup failed", error);
    return Response.json({ error: "Не удалось загрузить прогресс." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = (await request.json()) as Record<string, unknown>;

    if (input.action === "quest") {
      const questId = Number(input.questId);
      if (!Number.isInteger(questId) || questId < 1 || questId > 4 || typeof input.completed !== "boolean") {
        return Response.json({ error: "Некорректный квест." }, { status: 400 });
      }
      await setQuestCompletion(user.id, questId, input.completed);
    } else if (input.action === "event" && typeof input.registered === "boolean") {
      await setEventRegistration(user.id, input.registered);
    } else {
      return Response.json({ error: "Неизвестное действие." }, { status: 400 });
    }

    return Response.json(await getActivity(user.id));
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("QuestFit activity update failed", error);
    return Response.json({ error: "Не удалось сохранить действие." }, { status: 500 });
  }
}
