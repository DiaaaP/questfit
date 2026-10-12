import { getActivity, setEventRegistration, setQuestCompletion } from "@/backend/activity/repository";
import { apiError, requireSessionUser } from "@/backend/auth/request";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json(await getActivity(user.id));
  } catch (error) {
    return apiError(error, "Не удалось загрузить прогресс.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
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
    return apiError(error, "Не удалось сохранить действие.");
  }
}
