import { featuredEventSlug } from "./catalog";

export type DailyCompletion = { questId: number; day: string; xp: number };
export type EventFinish = { slug: string; xp: number; finishedAt: number };

export type ActivitySnapshot = {
  questDay: string;
  completedQuestIds: number[];
  todayQuestXp: number;
  questXp: number;
  eventXp: number;
  registeredEventSlugs: string[];
  registeredForEvent: boolean;
  finishedEvents: EventFinish[];
};

const dayMs = 86_400_000;
const almatyOffsetMs = 5 * 60 * 60 * 1000;

export function questPeriod(now = Date.now()) {
  const startsAt = Math.floor((now + almatyOffsetMs) / dayMs) * dayMs - almatyOffsetMs;
  return { day: new Date(startsAt + almatyOffsetMs).toISOString().slice(0, 10), startsAt, endsAt: startsAt + dayMs };
}

export function summarizeActivity(
  completions: readonly DailyCompletion[],
  registeredEventSlugs: string[],
  finishedEvents: EventFinish[],
  questDay = questPeriod().day,
): ActivitySnapshot {
  const today = completions.filter(({ day }) => day === questDay);
  return {
    questDay,
    completedQuestIds: today.map(({ questId }) => questId),
    todayQuestXp: today.reduce((sum, { xp }) => sum + xp, 0),
    questXp: completions.reduce((sum, { xp }) => sum + xp, 0),
    eventXp: finishedEvents.reduce((sum, { xp }) => sum + xp, 0),
    registeredEventSlugs,
    registeredForEvent: registeredEventSlugs.includes(featuredEventSlug),
    finishedEvents,
  };
}
