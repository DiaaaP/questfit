"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { catalogEvents, catalogQuests, dailyQuests, featuredEventSlug, starterEvents, type ArenaEvent, type Quest } from "@/shared/catalog";
import { buildDashboard, calculateWorkoutXp, type AdminData, type DashboardData, type NewWorkoutInput, type ProfilePreferences, type WorkoutEntry } from "@/shared/questfit";
import { adminStorageKey } from "./admin-section";
import type { ProfileUpdate } from "./account-views";
import { api, navigate, readLocal, type Athlete } from "./portal-ui";

type LocalAccount = { user: Athlete; passwordHash: string; salt?: string };
type ActivityData = { completedQuestIds: number[]; registeredEventSlugs: string[]; registeredForEvent?: boolean };
type Catalog = { quests: Quest[]; events: ArenaEvent[] };

const keys = {
  account: "qf_pages_account", session: "qf_pages_session", completed: "qf_pages_completed",
  event: "qf_pages_event_joined", events: "qf_pages_events", dashboard: "qf_pages_dashboard",
};

function isStatic() {
  return typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") || document.documentElement.dataset.deployment === "github-pages");
}
function noSubscribe() { return () => {}; }
function localEventSlugs() {
  return readLocal<string[]>(keys.events, localStorage.getItem(keys.event) === "true" ? [featuredEventSlug] : []);
}
function localCatalog(): Catalog {
  const saved = readLocal<AdminData | null>(adminStorageKey, null);
  const joined = localEventSlugs();
  return { quests: catalogQuests(saved?.quests ?? []), events: catalogEvents(saved?.events ?? []).map((event) => ({
    ...event, registrations: event.registrations + Number(joined.includes(event.slug)),
  })) };
}
function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function passwordDigest(password: string, salt?: string) {
  const bytes = new TextEncoder().encode(password);
  if (!salt) return toHex(await crypto.subtle.digest("SHA-256", bytes));
  const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 150000 }, key, 256));
}

export function useQuestFit() {
  const staticMode = useSyncExternalStore(noSubscribe, isStatic, () => false);
  const [user, setUser] = useState<Athlete | null>(null);
  const [ready, setReady] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [catalog, setCatalog] = useState<Catalog>({ quests: dailyQuests, events: starterEvents });
  const [catalogError, setCatalogError] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [joined, setJoined] = useState<string[]>([]);
  const [questPending, setQuestPending] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>(() => buildDashboard());
  const [dataError, setDataError] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const session = useRef<number | undefined>(undefined);
  const userId = user?.id;
  const firstName = user?.fullName.split(" ")[0] ?? "Атлет";

  const refreshCatalog = useCallback(() => {
    if (isStatic()) { setCatalog(localCatalog()); return; }
    void api<Catalog>("/api/catalog").then((next) => { setCatalog(next); setCatalogError(false); }).catch(() => setCatalogError(true));
  }, []);

  function hydrateLocal(current: Athlete) {
    setUser(current);
    const stored = readLocal<DashboardData | null>(keys.dashboard, null);
    setDashboard(buildDashboard(stored?.workouts ?? [], stored?.preferences, current.fullName.split(" ")[0]));
    setCompleted(readLocal<number[]>(keys.completed, []));
    setJoined(localEventSlugs());
    setDataReady(true);
  }

  useEffect(() => {
    let active = true;
    if (isStatic()) {
      const account = readLocal<LocalAccount | null>(keys.account, null);
      if (account && localStorage.getItem(keys.session) === "true") hydrateLocal(account.user);
      setCatalog(localCatalog()); setDataReady(true); setReady(true);
      return;
    }
    void api<Catalog>("/api/catalog").then((next) => active && setCatalog(next)).catch(() => active && setCatalogError(true));
    void api<{ user: Athlete | null }>("/api/auth/session")
      .then(({ user: current }) => { if (active) { session.current = current?.id; setUser(current); } })
      .catch((reason) => active && setAccountError(reason instanceof Error ? reason.message : "Сессия недоступна."))
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!userId || isStatic()) return;
    let active = true;
    Promise.all([api<ActivityData>("/api/activity"), api<DashboardData>("/api/dashboard")]).then(([activity, data]) => {
      if (!active) return;
      setCompleted(activity.completedQuestIds);
      setJoined(activity.registeredEventSlugs ?? (activity.registeredForEvent ? [featuredEventSlug] : []));
      setDashboard(data); setDataReady(true); setDataError("");
    }).catch((reason) => {
      if (active) { setDataReady(true); setDataError(reason instanceof Error ? reason.message : "Не удалось загрузить профиль."); }
    });
    return () => { active = false; };
  }, [userId]);

  async function authenticate(mode: "login" | "register", values: FormData) {
    const fullName = String(values.get("fullName") ?? "").trim().replace(/\s+/g, " ");
    const email = String(values.get("email") ?? "").trim().toLowerCase();
    const password = String(values.get("password") ?? "");
    const goal = "Баланс и выносливость";
    if (isStatic()) {
      const stored = readLocal<LocalAccount | null>(keys.account, null);
      if (mode === "register") {
        if (stored) throw new Error("В этом браузере уже есть локальный аккаунт. Войдите в него.");
        if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) throw new Error("Проверьте имя, почту и пароль.");
        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
        const next = { id: Date.now(), fullName, email, goal };
        localStorage.setItem(keys.account, JSON.stringify({ user: next, passwordHash: await passwordDigest(password, salt), salt }));
        hydrateLocal(next);
      } else {
        if (!stored || stored.user.email !== email || stored.passwordHash !== await passwordDigest(password, stored.salt)) throw new Error("Неверная почта или пароль.");
        if (!stored.salt) {
          const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
          localStorage.setItem(keys.account, JSON.stringify({ ...stored, passwordHash: await passwordDigest(password, salt), salt }));
        }
        hydrateLocal(stored.user);
      }
      localStorage.setItem(keys.session, "true");
    } else {
      const result = await api<{ user: Athlete }>(`/api/auth/${mode}`, "POST", { fullName, email, password, goal });
      if (session.current !== result.user.id) {
        setDataReady(false); setDataError(""); setCompleted([]); setJoined([]);
        setDashboard(buildDashboard([], undefined, result.user.fullName.split(" ")[0]));
      }
      session.current = result.user.id;
      setUser(result.user);
    }
    setAccountError("");
    toast.success(mode === "register" ? "Аккаунт создан" : "С возвращением");
  }

  async function logout() {
    try {
      if (isStatic()) localStorage.removeItem(keys.session);
      else await api("/api/auth/logout", "POST");
      session.current = undefined;
      setUser(null); setCompleted([]); setJoined([]); setDashboard(buildDashboard()); setDataError("");
      navigate("login"); toast.success("Вы вышли из аккаунта");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Не удалось завершить сеанс."); }
  }

  async function saveQuest(quest: Quest, value: boolean) {
    if (questPending) return false;
    setQuestPending(true);
    try {
      const next = value ? [...new Set([...completed, quest.id])] : completed.filter((qid) => qid !== quest.id);
      if (!user || isStatic()) {
        if (user) localStorage.setItem(keys.completed, JSON.stringify(next));
        setCompleted(next);
      } else {
        const saved = await api<ActivityData>("/api/activity", "POST", { action: "quest", questId: quest.id, completed: value });
        if (session.current === user.id) setCompleted(saved.completedQuestIds);
      }
      toast.success(value ? `Квест выполнен · +${quest.xp} XP` : "Отметка снята");
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Не удалось сохранить квест.");
      return false;
    }
    finally { setQuestPending(false); }
  }

  const completeQuestFromTool = useEffectEvent(async (input: unknown) => {
    const id = Number((input as { questId?: unknown })?.questId);
    const quest = catalog.quests.find((entry) => entry.id === id);
    if (!quest) throw new Error("Неизвестный квест.");
    if (!completed.includes(id) && !await saveQuest(quest, true)) throw new Error("Не удалось выполнить квест.");
    return { questId: id, title: quest.title, status: "completed", xp: quest.xp, saved: Boolean(user) };
  });

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: { registerTool(tool: unknown, options: { signal: AbortSignal }): void | Promise<void> };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool = {
      name: "complete_daily_quest",
      title: "Завершить квест",
      description: "Отмечает видимый квест QuestFit выполненным.",
      inputSchema: {
        type: "object",
        properties: { questId: { type: "integer", minimum: 1 } },
        required: ["questId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => completeQuestFromTool(input),
    };
    void Promise.resolve().then(() => context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  async function registerForEvent(event: ArenaEvent, registered: boolean) {
    if (!user) throw new Error("Войдите, чтобы записаться на старт.");
    if (isStatic()) {
      const current = localEventSlugs();
      if (registered && (event.startAt <= Date.now() || (event.registrations >= event.capacity && !current.includes(event.slug)))) {
        throw new Error("Запись закрыта или свободных мест больше нет.");
      }
      const next = registered ? [...new Set([...current, event.slug])] : current.filter((key) => key !== event.slug);
      localStorage.setItem(keys.events, JSON.stringify(next));
      localStorage.setItem(keys.event, String(next.includes(featuredEventSlug)));
      setJoined(next);
    } else {
      const next = await api<ActivityData>("/api/activity", "POST", { action: "event", eventSlug: event.slug, registered });
      if (session.current === user.id) setJoined(next.registeredEventSlugs);
    }
    refreshCatalog();
    toast.success(registered ? "Участие подтверждено" : "Запись отменена");
  }

  async function refreshDashboard(owner: number) {
    try {
      const next = await api<DashboardData>("/api/dashboard");
      if (session.current === owner) setDashboard(next);
    } catch { /* The successful mutation already updated the visible result. */ }
  }

  function applyWorkouts(workouts: WorkoutEntry[]) {
    const next = buildDashboard(workouts, dashboard.preferences, firstName);
    if (isStatic()) localStorage.setItem(keys.dashboard, JSON.stringify(next));
    setDashboard(isStatic() ? next : { ...next, leaderboard: dashboard.leaderboard });
  }
  async function saveWorkout(input: NewWorkoutInput) {
    if (!user) throw new Error("Войдите, чтобы сохранять тренировки.");
    if (input.title.length < 2) throw new Error("Укажите название тренировки.");
    const workout = isStatic() ? { ...input, id: Date.now(), xp: calculateWorkoutXp(input) }
      : (await api<{ workout: WorkoutEntry }>("/api/workouts", "POST", input)).workout;
    if (isStatic() || session.current === user.id) applyWorkouts([workout, ...dashboard.workouts]);
    if (!isStatic()) void refreshDashboard(user.id);
    toast.success("Тренировка записана", { description: `+${workout.xp} XP` });
    return workout;
  }
  async function deleteWorkout(id: number) {
    if (!user) throw new Error("Сеанс завершён.");
    if (!isStatic()) await api(`/api/workouts?id=${id}`, "DELETE");
    if (isStatic() || session.current === user.id) applyWorkouts(dashboard.workouts.filter((workout) => workout.id !== id));
    if (!isStatic()) void refreshDashboard(user.id);
    toast.success("Запись удалена");
  }

  async function saveProfile(update: ProfileUpdate) {
    if (!user) throw new Error("Войдите, чтобы сохранять настройки.");
    const preferences = { ...dashboard.preferences, ...update };
    const payload = { fullName: update.fullName ?? user.fullName, goal: update.goal ?? user.goal,
      city: preferences.city, weeklyGoalMinutes: preferences.weeklyGoalMinutes, notificationsEnabled: preferences.notificationsEnabled };
    if (payload.fullName.length < 2 || payload.city.length < 2 || payload.goal.length < 2) throw new Error("Проверьте имя, город и фитнес-цель.");
    if (isStatic()) {
      const stored = readLocal<LocalAccount | null>(keys.account, null);
      if (!stored) throw new Error("Локальный аккаунт недоступен.");
      const updated = { ...user, fullName: payload.fullName, goal: payload.goal };
      const next = buildDashboard(dashboard.workouts, preferences, updated.fullName.split(" ")[0]);
      localStorage.setItem(keys.account, JSON.stringify({ ...stored, user: updated }));
      localStorage.setItem(keys.dashboard, JSON.stringify(next));
      setUser(updated); setDashboard(next);
    } else {
      const saved = await api<{ user: Athlete; preferences: ProfilePreferences }>("/api/profile", "PATCH", payload);
      if (session.current === user.id) {
        setUser(saved.user);
        setDashboard((current) => ({ ...current, preferences: saved.preferences }));
        void refreshDashboard(user.id);
      }
    }
    toast.success("Настройки сохранены");
  }

  return { staticMode, user, ready, accountError, catalog, catalogError, dashboard, dataError, dataReady, firstName,
    completed, joined, questPending, refreshCatalog, authenticate, logout, saveQuest, registerForEvent, saveWorkout, deleteWorkout, saveProfile };
}
