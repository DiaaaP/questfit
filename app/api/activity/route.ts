import { getActivity, setEventRegistration, setQuestCompletion } from "@/backend/activity/repository";
import { apiError, requireSessionUser } from "@/backend/auth/request";
import { getCatalog } from "@/backend/catalog/repository";
import { dailyQuests, featuredEventSlug } from "@/shared/catalog";

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
      if (!Number.isSafeInteger(questId) || questId < 1 || typeof input.completed !== "boolean") {
        return Response.json({ error: "Некорректный квест." }, { status: 400 });
      }
      if (input.completed && !dailyQuests.some((quest) => quest.id === questId) &&
          !(await getCatalog()).quests.some((quest) => quest.id === questId)) {
        return Response.json({ error: "Этот квест сейчас недоступен." }, { status: 404 });
      }
      await setQuestCompletion(user.id, questId, input.completed);
    } else if (input.action === "event" && typeof input.registered === "boolean") {
      const slug = input.eventSlug ?? featuredEventSlug;
      if (typeof slug !== "string" || !/^[a-z0-9-]{2,80}$/.test(slug)) {
        return Response.json({ error: "Некорректное событие." }, { status: 400 });
      }
      if (!await setEventRegistration(user.id, input.registered, slug)) {
        return Response.json({ error: "Запись закрыта или свободных мест больше нет." }, { status: 409 });
      }
    } else {
      return Response.json({ error: "Неизвестное действие." }, { status: 400 });
    }

    return Response.json(await getActivity(user.id));
  } catch (error) {
    return apiError(error, "Не удалось сохранить действие.");
  }
}
