import { z } from "zod";
import { apiError, requireSessionUser } from "@/backend/auth/request";
import { updateProfile } from "@/backend/profile/repository";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(60),
  goal: z.string().trim().min(2).max(80),
  weeklyGoalMinutes: z.coerce.number().int().min(60).max(2000),
  city: z.string().trim().min(2).max(80),
  notificationsEnabled: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "Проверьте данные профиля." }, { status: 400 });
    }
    const preferences = await updateProfile(user.id, parsed.data);
    return Response.json({
      user: { ...user, fullName: parsed.data.fullName, goal: parsed.data.goal },
      preferences,
    });
  } catch (error) {
    return apiError(error, "Не удалось обновить профиль.");
  }
}
