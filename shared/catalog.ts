import type { AdminEvent, AdminQuest } from "./questfit";

export const customQuestOffset = 1000;
export const featuredEventSlug = "night-run-ural";

export type Quest = AdminQuest & { category: "strength" | "run" | "walk" | "team" | "custom" };
export type ArenaEvent = AdminEvent;

export const dailyQuests: Quest[] = [
  { id: 1, title: "Разминка героя", detail: "10 минут силовой разминки", xp: 40, category: "strength", active: true },
  { id: 2, title: "Пробежка 3 км", detail: "Пробеги 3 км в своём темпе", xp: 80, category: "run", active: true },
  { id: 3, title: "Время пройтись", detail: "20 минут прогулки на свежем воздухе", xp: 30, category: "walk", active: true },
  { id: 4, title: "Командная эстафета", detail: "Добавь вклад в командный рейд", xp: 120, category: "team", active: true },
];

export const starterEvents: ArenaEvent[] = [
  {
    id: -1,
    slug: featuredEventSlug,
    title: "Night Run Урал",
    location: "Уральск · Набережная Урала",
    distanceKm: 5,
    startAt: Date.parse("2026-11-28T19:00:00+05:00"),
    rewardXp: 150,
    capacity: 120,
    active: true,
    registrations: 0,
  },
];

export function catalogQuests(entries: AdminQuest[]): Quest[] {
  return [
    ...dailyQuests,
    ...entries.filter(({ active }) => active).map((quest): Quest => ({
      ...quest, id: quest.id + customQuestOffset, category: "custom",
    })),
  ];
}

export function catalogEvents(entries: ArenaEvent[]) {
  const overrides = new Set(entries.map(({ slug }) => slug));
  return [...starterEvents.filter(({ slug }) => !overrides.has(slug)), ...entries.filter(({ active }) => active)]
    .sort((a, b) => a.startAt - b.startAt);
}
