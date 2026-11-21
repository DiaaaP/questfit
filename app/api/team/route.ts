import { z } from "zod";
import { apiError, requireSessionUser } from "@/backend/auth/request";
import {
  contributeToTeam,
  createTeam,
  getTeamForUser,
  joinTeam,
  kickTeamMember,
  leaveTeam,
  TeamError,
  transferTeamLeadership,
} from "@/backend/team/repository";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(60), goalKm: z.coerce.number().int().min(10).max(10000) }),
  z.object({ action: z.literal("join"), code: z.string().trim().min(4).max(12) }),
  z.object({ action: z.literal("contribute"), distanceKm: z.coerce.number().positive().max(300) }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("kick"), userId: z.coerce.number().int().positive() }),
  z.object({ action: z.literal("transfer"), userId: z.coerce.number().int().positive() }),
]);

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json({ team: await getTeamForUser(user.id) });
  } catch (error) {
    return apiError(error, "Не удалось загрузить команду.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Проверьте параметры команды." }, { status: 400 });
    const input = parsed.data;
    const team = input.action === "create"
      ? await createTeam(user.id, input.name, input.goalKm)
      : input.action === "join"
        ? await joinTeam(user.id, input.code)
        : input.action === "contribute"
          ? await contributeToTeam(user.id, input.distanceKm)
          : input.action === "kick"
            ? await kickTeamMember(user.id, input.userId)
            : input.action === "transfer"
              ? await transferTeamLeadership(user.id, input.userId)
              : await leaveTeam(user.id);
    return Response.json({ team });
  } catch (error) {
    if (error instanceof TeamError) return Response.json({ error: error.message }, { status: error.status });
    return apiError(error, "Не удалось выполнить действие с командой.");
  }
}
