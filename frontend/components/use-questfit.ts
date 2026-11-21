"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { questPeriod, summarizeActivity, type ActivitySnapshot } from "@/shared/activity";
import { dailyQuests, starterEvents, type ArenaEvent, type Quest } from "@/shared/catalog";
import { buildDashboard, calculateWorkoutXp, type DashboardData, type NewWorkoutInput, type ProfilePreferences, type WorkoutEntry } from "@/shared/questfit";
import type { ProfileUpdate } from "./account-views";
import { browserActivity, browserCatalog, finishBrowserEvent, updateBrowserQuest, updateBrowserRegistration } from "./browser-activity";
import { api, navigate, readLocal, type Athlete } from "./portal-ui";

type LocalAccount = { user: Athlete; passwordHash: string; salt?: string };
type Catalog = { quests: Quest[]; events: ArenaEvent[] };

const keys = {
  account: "qf_pages_account", session: "qf_pages_session", dashboard: "qf_pages_dashboard",
};

function isStatic() {
  return typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") || document.documentElement.dataset.deployment === "github-pages");
}
function noSubscribe() { return () => {}; }
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
  const [questDay, setQuestDay] = useState(() => questPeriod().day);
  const [activity, setActivity] = useState(() => summarizeActivity([], [], []));
  const [questPending, setQuestPending] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>(() => buildDashboard());
  const [dataError, setDataError] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const session = useRef<number | undefined>(undefined);
  const userId = user?.id;
  const firstName = user?.fullName.split(" ")[0] ?? "Атлет";

  const refreshCatalog = useCallback(() => {
    if (isStatic()) {
      setCatalog(browserCatalog(Boolean(userId)));
      setActivity(browserActivity(Boolean(userId)));
      return;
    }
    const owner = session.current;
    void api<Catalog>("/api/catalog").then((next) => {
      if (session.current === owner) { setCatalog(next); setCatalogError(false); }
    }).catch(() => {
      if (session.current === owner) setCatalogError(true);
    });
  }, [userId]);

  function hydrateLocal(current: Athlete) {
    setUser(current);
    const stored = readLocal<DashboardData | null>(keys.dashboard, null);
    setDashboard(buildDashboard(stored?.workouts ?? [], stored?.preferences, current.fullName.split(" ")[0]));
    setActivity(browserActivity(true));
    setDataReady(true);
  }

  useEffect(() => {
    let active = true;
    if (isStatic()) {
      queueMicrotask(() => {
        if (!active) return;
        const account = readLocal<LocalAccount | null>(keys.account, null);
        if (account && localStorage.getItem(keys.session) === "true") hydrateLocal(account.user);
        setDataReady(true); setReady(true);
      });
    } else {
      void api<{ user: Athlete | null }>("/api/auth/session")
        .then(({ user: current }) => { if (active) { session.current = current?.id; setUser(current); } })
        .catch((reason) => active && setAccountError(reason instanceof Error ? reason.message : "Сессия недоступна."))
        .finally(() => active && setReady(true));
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    queueMicrotask(() => { if (active) refreshCatalog(); });
    return () => { active = false; };
  }, [ready, refreshCatalog]);

  useEffect(() => {
    let timeout: number;
    function syncDay() {
      window.clearTimeout(timeout);
      const period = questPeriod();
      setQuestDay(period.day);
      timeout = window.setTimeout(syncDay, Math.max(100, period.endsAt - Date.now() + 50));
    }
    syncDay();
    window.addEventListener("focus", syncDay);
    return () => { window.clearTimeout(timeout); window.removeEventListener("focus", syncDay); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    if (!userId || isStatic()) {
      queueMicrotask(() => { if (active) setActivity(browserActivity(Boolean(userId))); });
    } else {
      Promise.all([api<ActivitySnapshot>("/api/activity"), api<DashboardData>("/api/dashboard")]).then(([snapshot, data]) => {
        if (!active) return;
        setActivity(snapshot);
        setDashboard(data); setDataReady(true); setDataError("");
      }).catch((reason) => {
        if (active) { setDataReady(true); setDataError(reason instanceof Error ? reason.message : "Не удалось загрузить профиль."); }
      });
    }
    return () => { active = false; };
  }, [userId, questDay, ready]);

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
        setDataReady(false); setDataError(""); setActivity(summarizeActivity([], [], []));
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
      setUser(null); setActivity(browserActivity(false)); setDashboard(buildDashboard()); setDataError("");
      navigate("login"); toast.success("Вы вышли из аккаунта");
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Не удалось завершить сеанс."); }
  }

  async function saveQuest(quest: Quest, value: boolean) {
    if (questPending) return false;
    setQuestPending(true);
    try {
      if (!user || isStatic()) {
        setActivity(updateBrowserQuest(Boolean(user), quest.id, value ? quest.xp : null));
      } else {
        const saved = await api<ActivitySnapshot>("/api/activity", "POST", { action: "quest", questId: quest.id, completed: value });
        if (session.current === user.id) setActivity(saved);
      }
      toast.success(value ? `Квест выполнен · +${quest.xp} XP` : "Отметка снята", {
        description: user ? undefined : "Гостевой прогресс сохраняется в этом браузере.",
      });
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
    const completedToday = activity.questDay === questPeriod().day && activity.completedQuestIds.includes(id);
    if (!completedToday && !await saveQuest(quest, true)) throw new Error("Не удалось выполнить квест.");
    return { questId: id, title: quest.title, status: "completed", xp: quest.xp, saved: true,
      scope: user && !isStatic() ? "account" : "browser" };
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
      setActivity(updateBrowserRegistration(event, registered));
    } else {
      const next = await api<ActivitySnapshot>("/api/activity", "POST", { action: "event", eventSlug: event.slug, registered });
      if (session.current === user.id) setActivity(next);
    }
    refreshCatalog();
    toast.success(registered ? "Участие подтверждено" : "Запись отменена");
  }

  async function saveEventFinish(event: ArenaEvent) {
    if (!user) throw new Error("Войдите, чтобы отметить финиш.");
    const local = isStatic();
    const next = local ? finishBrowserEvent(event)
      : await api<ActivitySnapshot>("/api/activity", "POST", { action: "finishEvent", eventSlug: event.slug });
    if (local || session.current === user.id) setActivity(next);
    const finish = next.finishedEvents.find(({ slug }) => slug === event.slug);
    toast.success("Финиш отмечен", { description: finish ? `+${finish.xp} XP в прогрессе.` : undefined });
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
    completed: activity.questDay === questDay ? activity.completedQuestIds : [],
    todayQuestXp: activity.questDay === questDay ? activity.todayQuestXp : 0,
    joined: activity.registeredEventSlugs, questXp: activity.questXp, eventXp: activity.eventXp,
    finishedEvents: activity.finishedEvents, questPending, refreshCatalog, authenticate, logout, saveQuest, registerForEvent,
    saveEventFinish, saveWorkout, deleteWorkout, saveProfile };
}
