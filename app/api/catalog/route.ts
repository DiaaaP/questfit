import { getCatalog } from "@/backend/catalog/repository";
import { apiError } from "@/backend/auth/request";

export async function GET() {
  try {
    return Response.json(await getCatalog(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "Не удалось обновить задания и соревнования.");
  }
}
