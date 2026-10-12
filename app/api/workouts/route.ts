import { z } from "zod";
import { apiError, requireSessionUser } from "@/backend/auth/request";
import { createWorkout, deleteWorkout, listWorkouts } from "@/backend/workouts/repository";

const workoutSchema = z.object({
  title: z.string().trim().min(2).max(80),
  type: z.enum(["strength", "run", "walk", "cycling", "mobility"]),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  distanceKm: z.coerce.number().min(0).max(300),
  calories: z.coerce.number().int().min(0).max(10000),
  performedAt: z.coerce.number().int().positive(),
  notes: z.string().trim().max(300).default(""),
});

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json({ workouts: await listWorkouts(user.id) });
  } catch (error) {
    return apiError(error, "Не удалось загрузить тренировки.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const parsed = workoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Проверьте параметры тренировки." }, { status: 400 });
    }
    return Response.json({ workout: await createWorkout(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return apiError(error, "Не удалось записать тренировку.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const workoutId = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(workoutId) || workoutId < 1) {
      return Response.json({ error: "Некорректный идентификатор тренировки." }, { status: 400 });
    }
    const deleted = await deleteWorkout(user.id, workoutId);
    return deleted
      ? Response.json({ deleted: true })
      : Response.json({ error: "Тренировка не найдена." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Не удалось удалить тренировку.");
  }
}
