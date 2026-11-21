import { questPeriod, summarizeActivity, type DailyCompletion, type EventFinish } from "@/shared/activity";
import { catalogEvents, catalogQuests, featuredEventSlug, type ArenaEvent } from "@/shared/catalog";
import type { AdminData } from "@/shared/questfit";
import { readLocal } from "./portal-ui";

export const adminStorageKey = "qf_pages_admin";

const accountCompletions = "qf_pages_daily_quests";
const guestCompletions = "qf_guest_daily_quests";
const eventRegistrations = "qf_pages_events";
const legacyRegistration = "qf_pages_event_joined";
const eventFinishes = "qf_pages_event_finishes";

function readCompletions(account: boolean) {
  if (!account) return readLocal<DailyCompletion[]>(guestCompletions, []);
  const saved = readLocal<DailyCompletion[] | null>(accountCompletions, null);
  if (saved) return saved;

  const legacy = readLocal<number[]>("qf_pages_completed", []);
  const admin = readLocal<AdminData | null>(adminStorageKey, null);
  const quests = catalogQuests(admin?.quests ?? []);
  const day = questPeriod().day;
  const completions = [...new Set(legacy)].flatMap((id) => {
    const quest = quests.find((item) => item.id === id);
    return quest ? [{ questId: id, day, xp: quest.xp }] : [];
  });
  localStorage.setItem(accountCompletions, JSON.stringify(completions));
  return completions;
}

export function browserCatalog(account: boolean) {
  const saved = readLocal<AdminData | null>(adminStorageKey, null);
  const joined = account ? browserRegistrations() : [];
  return {
    quests: catalogQuests(saved?.quests ?? []),
    events: catalogEvents(saved?.events ?? [], joined, !saved).map((event) => ({
      ...event, registrations: event.registrations + Number(joined.includes(event.slug)),
    })),
  };
}

function browserRegistrations() {
  const stored = readLocal<string[]>(eventRegistrations,
    localStorage.getItem(legacyRegistration) === "true" ? [featuredEventSlug] : []);
  const saved = readLocal<AdminData | null>(adminStorageKey, null);
  if (!saved) return stored;
  return stored.filter((slug) => saved.events.some((event) => event.slug === slug));
}

export function browserActivity(account: boolean) {
  return summarizeActivity(
    readCompletions(account),
    account ? browserRegistrations() : [],
    account ? readLocal<EventFinish[]>(eventFinishes, []) : [],
  );
}

export function updateBrowserQuest(account: boolean, questId: number, xp: number | null) {
  const day = questPeriod().day;
  const entries = readCompletions(account);
  const matching = (entry: DailyCompletion) => entry.questId === questId && entry.day === day;
  if (xp === null) {
    localStorage.setItem(account ? accountCompletions : guestCompletions, JSON.stringify(entries.filter((entry) => !matching(entry))));
  } else if (!entries.some(matching)) {
    localStorage.setItem(account ? accountCompletions : guestCompletions, JSON.stringify([...entries, { questId, day, xp }]));
  }
  return browserActivity(account);
}

function storeRegistrations(slugs: string[]) {
  localStorage.setItem(eventRegistrations, JSON.stringify(slugs));
  localStorage.setItem(legacyRegistration, String(slugs.includes(featuredEventSlug)));
}

export function removeBrowserRegistration(slug: string) {
  const legacy = localStorage.getItem(legacyRegistration) === "true" ? [featuredEventSlug] : [];
  storeRegistrations(readLocal<string[]>(eventRegistrations, legacy).filter((item) => item !== slug));
}

export function updateBrowserRegistration(event: ArenaEvent, registered: boolean) {
  const current = browserActivity(true);
  if (!registered && current.finishedEvents.some(({ slug }) => slug === event.slug)) {
    throw new Error("Запись с подтверждённым финишем отменить нельзя.");
  }
  if (registered && !current.registeredEventSlugs.includes(event.slug) &&
      (!event.active || event.startAt <= Date.now() || event.registrations >= event.capacity)) {
    throw new Error("Запись закрыта или свободных мест больше нет.");
  }
  storeRegistrations(registered
    ? [...new Set([...current.registeredEventSlugs, event.slug])]
    : current.registeredEventSlugs.filter((slug) => slug !== event.slug));
  return browserActivity(true);
}

export function finishBrowserEvent(event: ArenaEvent) {
  const current = browserActivity(true);
  if (current.finishedEvents.some(({ slug }) => slug === event.slug)) return current;
  const now = Date.now();
  if (!current.registeredEventSlugs.includes(event.slug) || event.startAt > now) {
    throw new Error("Отметить финиш можно после начала старта, на который вы записаны.");
  }
  localStorage.setItem(eventFinishes, JSON.stringify([...current.finishedEvents, { slug: event.slug, xp: event.rewardXp, finishedAt: now }]));
  return browserActivity(true);
}
