import { demoMode } from "./runtime.js";
import { readLocal, storeLocal } from "./ui.js";
import { buildDashboard, calculateWorkoutXp, defaultPreferences } from "./workout-data.js";

export { demoMode };

const dayMs = 86_400_000;
const offset = 5 * 3600000;
export function questPeriod(now = Date.now()) {
  const localMidnight = Math.floor((now + offset) / dayMs) * dayMs;
  return { day: new Date(localMidnight).toISOString().slice(0, 10), endsAt: localMidnight - offset + dayMs };
}

let seed;
export async function loadSeed() {
  if (seed) return seed;
  const response = await fetch(new URL("./catalog.json", import.meta.url));
  if (!response.ok) throw new Error("Не удалось загрузить каталог.");
  seed = await response.json();
  return seed;
}

const keys = Object.freeze({
  account: "qf_pages_account", session: "qf_pages_session", dashboard: "qf_pages_dashboard",
  quests: "qf_pages_daily_quests", guest: "qf_guest_daily_quests", oldQuests: "qf_pages_completed",
  finishes: "qf_pages_event_finishes", registrations: "qf_pages_events", oldRegistration: "qf_pages_event_joined",
  team: "qf_pages_team", admin: "qf_pages_admin", next: "qf_pages_next_admin_ids",
});

const directoryExamples = [
  { id: -101, fullName: "Айжан Абдиева", city: "Астана", teamName: "Степной темп", goalKm: 90 },
  { id: -102, fullName: "Арман Толеу", city: "Шымкент", teamName: "Южный маршрут", goalKm: 120 },
];
const exampleUsers = directoryExamples.map(({ id, fullName, city, teamName }) => ({
  id, fullName, city, teamName, email: "—", workoutCount: 0, sample: true,
}));
const exampleTeams = directoryExamples.map(({ id, fullName, city, teamName, goalKm }) => ({
  id, name: teamName, city, captainName: fullName, memberCount: 1, goalKm, sample: true,
}));

function localUser() {
  return localStorage.getItem(keys.session) === "true" ? readLocal(keys.account, null)?.user ?? null : null;
}

function localAdmin() {
  const user = localUser();
  const saved = readLocal(keys.admin, null);
  const dashboard = readLocal(keys.dashboard, null);
  const team = readLocal(keys.team, null);
  const city = dashboard?.preferences?.city ?? defaultPreferences.city;
  const captain = team?.members.find(member => member.userId === team.leaderId);
  const users = user ? [{...user, city, createdAt: user.id, workoutCount: dashboard?.workouts.length ?? 0, teamName: team?.name ?? null}, ...exampleUsers] : [];
  const teams = user ? [...exampleTeams] : [];
  if (user && team && captain) {
    teams.unshift({
      id: team.id, name: team.name, captainName: captain.name,
      city: captain.userId === user.id ? city : defaultPreferences.city,
      memberCount: team.members.length, goalKm: team.goalKm,
    });
  }
  return {
    quests: saved?.quests ?? [],
    events: saved?.events ?? seed.events.map(event => ({...event, id: 1})),
    users, teams,
  };
}

function localQuests(activeOnly = true) {
  const admin = localAdmin();
  return [...seed.quests, ...admin.quests.filter(quest => !activeOnly || quest.active).map(quest => ({
    ...quest, id: quest.id + 1000, category: "custom",
  }))];
}

function registrationSlugs() {
  const fallback = localStorage.getItem(keys.oldRegistration) === "true" ? [seed.events[0].slug] : [];
  return readLocal(keys.registrations, fallback).filter(slug => localAdmin().events.some(event => event.slug === slug));
}

function storeRegistrations(slugs) {
  storeLocal(keys.registrations, slugs);
  localStorage.setItem(keys.oldRegistration, String(slugs.includes(seed.events[0].slug)));
}

function localCatalog() {
  const { events } = localAdmin();
  const joined = localUser() ? registrationSlugs() : [];
  return { quests: localQuests(), events: events.filter(event => event.active || joined.includes(event.slug))
    .map(event => ({...event, registrations: Number(joined.includes(event.slug))}))
    .sort((a, b) => a.startAt - b.startAt) };
}

function questRecords(account) {
  if (!account) return readLocal(keys.guest, []);
  const stored = readLocal(keys.quests, null);
  if (stored) return stored;
  const day = questPeriod().day;
  const quests = new Map(localQuests(false).map(quest => [quest.id, quest.xp]));
  const records = Array.from(new Set(readLocal(keys.oldQuests, []))).filter(id => quests.has(id))
    .map(id => ({questId: id, day, xp: quests.get(id)}));
  storeLocal(keys.quests, records);
  return records;
}

export function localActivity(account = false) {
  const questDay = questPeriod().day;
  const completions = questRecords(account);
  const today = completions.filter(item => item.day === questDay);
  const finishedEvents = account ? readLocal(keys.finishes, []) : [];
  const registeredEventSlugs = account ? registrationSlugs() : [];
  return {
    questDay, completedQuestIds: today.map(item => item.questId),
    todayQuestXp: today.reduce((sum, item) => sum + item.xp, 0),
    questXp: completions.reduce((sum, item) => sum + item.xp, 0),
    eventXp: finishedEvents.reduce((sum, item) => sum + item.xp, 0),
    registeredEventSlugs, finishedEvents,
  };
}

export function localQuest(account, quest, completed) {
  if (!quest || !quest.active) throw new Error("Этот квест сейчас недоступен.");
  const records = questRecords(account);
  const day = questPeriod().day;
  const same = item => item.day === day && item.questId === quest.id;
  const storageKey = account ? keys.quests : keys.guest;
  if (!completed) storeLocal(storageKey, records.filter(item => !same(item)));
  else if (!records.some(same)) storeLocal(storageKey, [...records, { questId: quest.id, day, xp: quest.xp }]);
  return localActivity(account);
}

function localEvent(command) {
  const state = localActivity(true);
  const slug = command.eventSlug;
  const event = localCatalog().events.find(item => item.slug === slug);
  const joined = state.registeredEventSlugs.includes(slug);
  const finished = state.finishedEvents.some(item => item.slug === slug);
  if (command.action === "finishEvent") {
    if (finished) return state;
    if (!joined || !event || event.startAt > Date.now()) throw new Error("Отметить финиш можно после начала старта, на который вы записаны.");
    storeLocal(keys.finishes, [...state.finishedEvents, {slug, xp: event.rewardXp, finishedAt: Date.now()}]);
  } else if (!command.registered) {
    if (finished) throw new Error("Запись с подтверждённым финишем отменить нельзя.");
    storeRegistrations(state.registeredEventSlugs.filter(item => item !== slug));
  } else if (!joined) {
    if (!event || !event.active || event.startAt <= Date.now() || event.registrations >= event.capacity)
      throw new Error("Запись закрыта или свободных мест больше нет.");
    storeRegistrations([...state.registeredEventSlugs, slug]);
  }
  return localActivity(true);
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(password, salt) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(password);
  if (!salt) return hex(await crypto.subtle.digest("SHA-256", bytes));
  const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 150000,
  }, key, 256));
}

async function authDemo(path, data) {
  const account = readLocal(keys.account, null);
  if (path === "register" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.password.length < 8))
    throw new Error("Укажите корректную почту и пароль от 8 символов.");
  if (path === "register" && account) throw new Error("В этом браузере уже есть локальный аккаунт. Войдите в него.");
  if (path === "login" && (!account || account.user.email !== data.email || account.passwordHash !== await digest(data.password, account.salt)))
    throw new Error("Неверная почта или пароль.");
  const user = account?.user ?? {id: Date.now(), fullName: data.fullName, email: data.email, goal: "Баланс и выносливость"};
  if (!account?.salt) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    storeLocal(keys.account, {user, salt, passwordHash: await digest(data.password, salt)});
  }
  localStorage.setItem(keys.session, "true");
  return {user};
}

function localDashboard(user) {
  const saved = readLocal(keys.dashboard, null);
  return buildDashboard(saved?.workouts ?? [], saved?.preferences, user.fullName.split(" ")[0]);
}

function localTeam(user, input) {
  const current = readLocal(keys.team, null);
  if (!input) return current;
  const team = current ? structuredClone(current) : null;
  const member = {userId: user.id, name: user.fullName, contributionKm: 0, xp: 0, joinedAt: Date.now()};
  if (input.action === "create" || input.action === "join") {
    if (team) throw new Error("Сначала выйдите из текущей команды.");
    if (input.action === "create") {
      const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), value => characters[value % characters.length]).join("");
      return {id: Date.now(), name: input.name, code, goalKm: input.goalKm, totalKm: 0, leaderId: user.id, members: [{...member, role: "leader"}]};
    }
    if (input.code.toUpperCase() !== "URAL25") throw new Error("В браузерном демо доступен код URAL25.");
    return {
      id: -1, name: "Северный ветер", code: "URAL25", goalKm: 100, totalKm: 42, leaderId: -2,
      members: [{ userId: -2, name: "Кира Мороз", role: "leader", contributionKm: 42, xp: 1680, joinedAt: Date.now() }, {...member, role: "member"}],
    };
  }
  if (!team) throw new Error("Сначала вступите в команду.");
  if (input.action === "leave") return null;
  if (input.action === "contribute") {
    const athlete = team.members.find(entry => entry.userId === user.id);
    athlete.contributionKm = Math.round((athlete.contributionKm + input.distanceKm) * 10) / 10;
    athlete.xp += Math.round(input.distanceKm * 40);
  } else {
    const target = team.members.find(entry => entry.userId === input.userId && entry.userId !== user.id);
    if (team.leaderId !== user.id || !target) throw new Error("Управление доступно лидеру команды.");
    if (input.action === "kick") team.members = team.members.filter(entry => entry !== target);
    else {
      team.leaderId = target.userId;
      for (const entry of team.members) entry.role = entry === target ? "leader" : "member";
    }
  }
  team.totalKm = Math.round(10 * team.members.reduce((sum, entry) => sum + entry.contributionKm, 0)) / 10;
  return team;
}

function editDemoAdmin(data) {
  const admin = localAdmin();
  const key = data.action.endsWith("Quest") ? "quests" : "events";
  const entries = admin[key];
  const values = {...data};
  delete values.action;
  if (data.action.startsWith("create")) {
    const next = readLocal(keys.next, {});
    const id = Math.max(next[key] ?? 1, ...entries.map(item => item.id + 1));
    storeLocal(keys.next, {...next, [key]: id + 1});
    entries.push({...values, id, ...(key === "events" ? {registrations: 0} : {})});
  } else {
    const index = entries.findIndex(item => item.id === data.id);
    if (index === -1) throw new Error("Запись не найдена.");
    if (data.action.startsWith("delete")) {
      if (key === "events") storeRegistrations(registrationSlugs().filter(slug => slug !== entries[index].slug));
      entries.splice(index, 1);
    } else {
      entries[index] = {...entries[index], ...values};
    }
  }
  storeLocal(keys.admin, {quests: admin.quests, events: admin.events});
  return localAdmin();
}

async function demoApi(path, method, data) {
  const user = localUser();
  if (path === "/api/catalog") return localCatalog();
  if (path === "/api/auth/session") return {user};
  if (path === "/api/auth/logout") {
    localStorage.removeItem(keys.session);
    return {success: true};
  }
  if (path === "/api/auth/login" || path === "/api/auth/register") return authDemo(path.split("/").at(-1), data);
  if (!user) throw new Error("Войдите в аккаунт.");
  if (path === "/api/dashboard") return localDashboard(user);
  if (path === "/api/activity") {
    if (method === "GET") return localActivity(true);
    const quest = localQuests().find(item => item.id === data.questId);
    return data.action === "quest" ? localQuest(true, quest, data.completed) : localEvent(data);
  }
  if (path === "/api/team") {
    const team = localTeam(user, data);
    if (data) storeLocal(keys.team, team);
    return {team};
  }
  if (path === "/api/admin") return data ? editDemoAdmin(data) : localAdmin();
  const dashboard = localDashboard(user);
  if (path === "/api/profile") {
    const updated = {...user, fullName: data.fullName, goal: data.goal};
    const prefs = {city: data.city, weeklyGoalMinutes: data.weeklyGoalMinutes, notificationsEnabled: data.notificationsEnabled};
    storeLocal(keys.account, {...readLocal(keys.account, {}), user: updated});
    storeLocal(keys.dashboard, {...dashboard, preferences: prefs});
    const team = readLocal(keys.team, null);
    if (team) storeLocal(keys.team, {...team, members: team.members.map(item => item.userId === user.id ? {...item, name: updated.fullName} : item)});
    return {user: updated, preferences: prefs};
  }
  if (path === "/api/workouts" && method === "GET") return {workouts: dashboard.workouts};
  if (path === "/api/workouts" && method === "POST") {
    const id = Math.max(Date.now(), ...dashboard.workouts.map(item => item.id + 1));
    const workout = {...data, id, xp: calculateWorkoutXp(data)};
    storeLocal(keys.dashboard, {...dashboard, workouts: [workout, ...dashboard.workouts]});
    return {workout};
  }
  if (path.startsWith("/api/workouts?") && method === "DELETE") {
    const id = Number(new URL(path, location.href).searchParams.get("id"));
    storeLocal(keys.dashboard, {...dashboard, workouts: dashboard.workouts.filter(item => item.id !== id)});
    return {deleted: true};
  }
  throw new Error("Действие недоступно.");
}

export async function api(path, method = "GET", data) {
  if (demoMode) return demoApi(path, method, data);
  const response = await fetch(path, {
    method, cache: "no-store",
    ...(data === undefined ? {} : {headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || "Сервис временно недоступен. Попробуйте ещё раз.");
  return result;
}
