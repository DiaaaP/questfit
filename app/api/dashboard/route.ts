import { apiError, requireSessionUser } from "@/backend/auth/request";
import { getDashboard } from "@/backend/dashboard/repository";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json(await getDashboard(user.id, user.fullName.split(" ")[0]));
  } catch (error) {
    return apiError(error, "Не удалось загрузить аналитику.");
  }
}
