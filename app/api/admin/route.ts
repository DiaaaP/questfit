import { z } from "zod";
import { createEvent, createQuest, deleteEvent, deleteQuest, getAdminData, updateEvent, updateQuest } from "@/backend/admin/repository";
import { apiError, requireAdminUser } from "@/backend/auth/request";

const questFields = {
  title: z.string().trim().min(2).max(80),
  detail: z.string().trim().min(2).max(160),
  xp: z.coerce.number().int().min(10).max(10000),
  active: z.boolean(),
};

const eventFields = {
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(120),
  distanceKm: z.coerce.number().positive().max(1000),
  startAt: z.coerce.number().int().positive(),
  rewardXp: z.coerce.number().int().min(10).max(100000),
  capacity: z.coerce.number().int().min(1).max(100000),
  active: z.boolean(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createQuest"), ...questFields }),
  z.object({ action: z.literal("updateQuest"), id: z.coerce.number().int().positive(), ...questFields }),
  z.object({ action: z.literal("deleteQuest"), id: z.coerce.number().int().positive() }),
  z.object({ action: z.literal("createEvent"), ...eventFields }),
  z.object({ action: z.literal("updateEvent"), id: z.coerce.number().int().positive(), ...eventFields }),
  z.object({ action: z.literal("deleteEvent"), id: z.coerce.number().int().positive() }),
]);

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    return Response.json(await getAdminData());
  } catch (error) {
    return apiError(error, "Не удалось загрузить админ-панель.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Проверьте данные формы." }, { status: 400 });
    const input = parsed.data;
    if (input.action === "createQuest") await createQuest(input);
    else if (input.action === "updateQuest") await updateQuest(input);
    else if (input.action === "deleteQuest") await deleteQuest(input.id);
    else if (input.action === "createEvent") await createEvent(input);
    else if (input.action === "updateEvent") await updateEvent(input);
    else await deleteEvent(input.id);
    return Response.json(await getAdminData());
  } catch (error) {
    return apiError(error, "Не удалось обновить данные админ-панели.");
  }
}
