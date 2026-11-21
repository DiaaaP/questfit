import { getCatalog } from "@/backend/catalog/repository";
import { apiError } from "@/backend/auth/request";
import { getSessionUser } from "@/backend/auth/service";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    return Response.json(await getCatalog(user?.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error, "Не удалось обновить задания и соревнования.");
  }
}
