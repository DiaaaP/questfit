import { finishEvent, getActivity, setEventRegistration, setQuestCompletion } from "@/backend/activity/repository";
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
      if (input.completed) {
        const quest = dailyQuests.find((item) => item.id === questId) ??
          (await getCatalog()).quests.find((item) => item.id === questId);
        if (!quest) return Response.json({ error: "Этот квест сейчас недоступен." }, { status: 404 });
        await setQuestCompletion(user.id, questId, quest.xp);
      } else {
        await setQuestCompletion(user.id, questId, null);
      }
    } else if ((input.action === "event" && typeof input.registered === "boolean") || input.action === "finishEvent") {
      const slug = input.eventSlug ?? featuredEventSlug;
      if (typeof slug !== "string" || !/^[a-z0-9-]{2,80}$/.test(slug)) {
        return Response.json({ error: "Некорректное событие." }, { status: 400 });
      }
      if (input.action === "finishEvent") {
        if (!await finishEvent(user.id, slug)) {
          return Response.json({ error: "Отметить финиш можно после начала старта, на который вы записаны." }, { status: 409 });
        }
      } else {
        const registered = input.registered === true;
        if (!await setEventRegistration(user.id, registered, slug)) {
          const error = registered ? "Запись закрыта или свободных мест больше нет." : "Запись с подтверждённым финишем отменить нельзя.";
          return Response.json({ error }, { status: 409 });
        }
      }
    } else {
      return Response.json({ error: "Неизвестное действие." }, { status: 400 });
    }

    return Response.json(await getActivity(user.id));
  } catch (error) {
    return apiError(error, "Не удалось сохранить действие.");
  }
}
