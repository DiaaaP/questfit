import { account, authView } from "./account.js";
import { arena, eventSignup, eventView, overview, questCatalog, questDetail } from "./catalog-views.js";
import { api, demoMode, loadSeed, localActivity, localQuest, questPeriod } from "./data.js";
import { adminView, teamPreview, teamView } from "./management.js";
import { achievements, activityChoice, filteredWorkouts, journal, leaderboard, progress, workoutDetail, workoutForm } from "./training.js";
import { brand, button, empty, go, html, icon, localDate, needAccount, weekMinutes, write } from "./ui.js";
import { buildDashboard, calculateWorkoutXp, workoutTypeLabels } from "./workout-data.js";
import { pages, navigation } from "./routes.js";

const root = document.querySelector("#app");
const status = document.querySelector("#notices");
const initialUI = () => ({ period: 7, questFilter: "all", arenaFilter: "all", earned: false, selected: null, confirm: null });
const state = {
  user: null, dashboard: buildDashboard(), team: null, admin: null, catalog: {quests: [], events: []},
  activity: localActivity(), failures: {}, ready: false, demo: demoMode,
};
let ui = initialUI();
let timer, noticeTimer;
let activeRequests = 0;

function route() {
  const raw = location.hash.slice(1) || "overview";
  const [path, query] = raw.split("?");
  const [head, id, step] = path.split("/");
  let view = head === "squad" ? "team" : head;
  if (head === "workout" && id === "new") view = step ? "workout/metrics" : "workout/new";
  if (head === "event" && step === "join") view = "event/join";
  if ((head === "team" || head === "admin") && id) view = head + "/" + id;
  if (view === "team/raid") view = "team";
  const proposed = new URLSearchParams(query).get("next") || "overview";
  const first = proposed.split("/")[0];
  const next = /^[a-z0-9/-]+$/.test(proposed) && !["login", "register"].includes(first) && Object.hasOwn(pages, first)
    ? proposed : "overview";
  let section = view.split("/")[0];
  if (section === "workout") section = "workouts";
  if (section === "quest") section = "quests";
  if (section === "event") section = "arena";
  if (["goal", "achievements", "leaderboard"].includes(section)) section = "progress";
  if (section === "notifications") section = "profile";
  return { raw, view, id, step, next, section };
}

function notice(message, isError = false) {
  clearTimeout(noticeTimer);
  status.dataset.error = String(isError);
  status.textContent = message;
  noticeTimer = setTimeout(() => { status.textContent = ""; }, 4300);
}

function props() {
  const now = Date.now();
  const current = state.activity.questDay === questPeriod(now).day;
  const { registeredEventSlugs: joined, finishedEvents: finishes } = state.activity;
  const xp = state.dashboard.totals.workoutXp + state.activity.questXp + state.activity.eventXp;
  return {
    ...state, now, joined, finishes, xp, level: Math.floor(xp / 400) + 1,
    completed: current ? state.activity.completedQuestIds : [],
    todayXp: current ? state.activity.todayQuestXp : 0,
    featured: state.catalog.events.find(item => item.active && item.startAt > now),
    reminders: state.catalog.events.filter(item => joined.includes(item.slug) && item.startAt > now),
    week: weekMinutes(state.dashboard.workouts, now),
  };
}

function isAdmin() {
  return Boolean(state.user && (demoMode || state.user.id === 1));
}

function accountPrompt({ view, section }) {
  if (view === "workout/new" || view === "workout/metrics")
    return "Аккаунт нужен для журнала и сохранения результатов тренировок.";
  if (view === "event/join") return "Войдите, чтобы сохранить место на старте.";
  if (section === "team" && Object.hasOwn(pages, view))
    return "Аккаунт нужен для вступления в команду и сохранения вклада в общий рейд.";
  if (["profile", "goal", "notifications"].includes(view))
    return "Личные настройки и напоминания доступны после входа.";
  return "";
}

function viewContent(page, data, prompt) {
  const { view, id, step, raw } = page;
  if (prompt) return needAccount(prompt, raw);
  const needsWorkoutData = ["overview", "workouts", "workout", "progress", "goal", "achievements", "leaderboard", "profile", "notifications"].includes(view);
  if (data.failures.dashboard && needsWorkoutData) return unavailable("Данные пока недоступны", data.failures.dashboard);
  if (data.user && data.failures.team && page.section === "team") return unavailable("Команда недоступна", data.failures.team);
  if (view === "overview") return overview(data);
  if (view === "quests") return questCatalog(data.catalog.quests, data.completed, data.todayXp, ui.questFilter);
  if (view === "quest") return questDetail(data.catalog.quests.find(quest => quest.id === Number(id)), data.completed.includes(Number(id)));
  if (view === "workouts") return journal(data.dashboard.workouts, data.now);
  if (view === "workout") return workoutDetail(data.dashboard.workouts.find(workout => workout.id === Number(id)), Boolean(data.user), ui.confirm);
  if (view === "workout/new" || view === "workout/metrics") {
    return step && Object.hasOwn(workoutTypeLabels, step) ? workoutForm(step, data.now) : activityChoice();
  }
  if (view === "progress") return progress(data.dashboard, data.now, ui.period);
  if (view === "achievements") return achievements(data.dashboard, ui.earned);
  if (view === "leaderboard") return leaderboard(data.dashboard, !data.user || demoMode);
  if (view === "arena") return arena(data, ui.arenaFilter);
  if (view === "event" || view === "event/join") {
    const event = data.catalog.events.find(item => item.slug === id);
    const joined = data.joined.includes(id);
    if (view === "event/join") return eventSignup(event, data.user, joined, data.now);
    return eventView(event, joined, data.finishes.find(item => item.slug === id), data.now, ui.confirm);
  }
  if (page.section === "team" && Object.hasOwn(pages, view)) {
    return teamView(id, data, ui.confirm);
  }
  if (page.section === "admin" && Object.hasOwn(pages, view)) {
    if (!isAdmin()) return empty("Доступ ограничен", "Управление каталогом доступно владельцу QuestFit.", go("overview", "На главную"));
    if (data.failures.admin) return unavailable("Админ-панель недоступна", data.failures.admin);
    return adminView(id, data, ui.selected);
  }
  if (["profile", "goal", "notifications"].includes(view)) return account(view, data);
  return empty("Страница не найдена", "Выберите нужный раздел в меню.", go("overview", "На главную", true));
}

function unavailable(title, message) {
  return empty(title, message, button("reload", "Повторить"));
}

function portalFrame() {
  if (root.querySelector("#main-content")) return;
  root.replaceChildren(document.querySelector("#portal").content.cloneNode(true));
  write(root.querySelector("#brand"), brand());
  write(root.querySelector('[data-action="menu"]'), icon("Menu", 21));
  write(root.querySelector(".portal-mobile-close"), icon("X", 21));
  root.querySelector("footer span").textContent = demoMode ? "Браузерное демо · данные на этом устройстве" : "Тренировки, квесты и спортивные старты";
}

function render() {
  if (!state.ready) return;
  const page = route();
  const [title, description] = Object.hasOwn(pages, page.view) ? pages[page.view] : ["Страница не найдена", ""];
  document.title = title + " · QuestFit";
  if (page.view === "register" || page.view === "login") {
    write(root, authView(page.view, demoMode, page.next));
    return;
  }
  portalFrame();
  const data = props();
  const {user, dashboard} = data;
  const prompt = !user && accountPrompt(page);
  const initials = user?.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  root.querySelector("#screen-title").textContent = title;
  root.querySelector("#screen-description").textContent = description;
  root.querySelector("#screen-description").hidden = !description;
  write(root.querySelector("nav"), navigation.filter(([key]) => key !== "admin" || isAdmin()).map(([key, label, glyph]) => html`
    <a href="#${key}" ${page.section === key && html`aria-current="page"`}>${icon(glyph)}${label}</a>
  `));
  write(root.querySelector(".portal-sidebar-bottom"), html`
    <span class="portal-sidebar-label">${icon("MapPin", 16)} ${dashboard.preferences.city}</span>
    <div class="portal-sidebar-identity">
      <span class="portal-avatar">${initials || icon("UserRound", 18)}</span>
      <span><strong>${user?.fullName ?? "Гость"}</strong><small>${user ? "Уровень " + data.level : "Гостевой режим"}</small></span>
    </div>`);
  write(root.querySelector(".portal-top-actions"), user ? html`
    ${page.view !== "notifications" && html`<a href="#notifications" class="portal-icon-button" aria-label="Уведомления">${icon("Bell", 19)}${dashboard.preferences.notificationsEnabled && data.reminders.length > 0 && html`<i></i>`}</a>`}
    ${page.view !== "profile" && html`<a href="#profile" class="portal-avatar portal-profile-shortcut" aria-label="Профиль">${initials}</a>`}`
    : !prompt && html`${go("login", "Войти")}${go("register", "Создать аккаунт", true)}`);
  write(root.querySelector("#screen-notes"), html`
    ${!user && page.view === "overview" && html`<div class="portal-demo-note"><span class="portal-chip">Демо</span> Пример прогресса. Создайте аккаунт, чтобы вести свой журнал.</div>`}
    ${state.failures.session && html`<div class="portal-alert" role="status">${state.failures.session}</div>`}
    ${state.failures.catalog && ["overview", "quests", "arena"].includes(page.section) && html`<div class="portal-alert"><span>Каталог временно недоступен. Показаны примеры.</span>${button("reload-catalog", "Обновить")}</div>`}
    ${state.failures.activity && ["overview", "quests", "arena"].includes(page.section) && html`<div class="portal-alert" role="status">${state.failures.activity} ${button("reload", "Повторить")}</div>`}
  `);
  write(root.querySelector("#screen"), viewContent(page, data, prompt));
}

async function refresh(keys) {
  const owner = state.user?.id;
  const endpoints = {
    catalog: "/api/catalog", dashboard: "/api/dashboard", activity: "/api/activity",
    team: "/api/team", admin: "/api/admin",
  };
  await Promise.all(keys.map(async key => {
    try {
      const result = await api(endpoints[key]);
      if (owner !== state.user?.id) return;
      state[key] = key === "team" ? result.team : result;
      delete state.failures[key];
    } catch (reason) {
      if (owner === state.user?.id) state.failures[key] = reason.message;
    }
  }));
}

async function hydrate() {
  state.dashboard = buildDashboard(state.user ? [] : undefined);
  state.activity = localActivity();
  state.team = null;
  state.admin = null;
  state.failures = {};
  const keys = ["catalog"];
  if (state.user) keys.push("dashboard", "activity", "team");
  if (isAdmin()) keys.push("admin");
  await refresh(keys);
}

async function start() {
  try {
    state.catalog = await loadSeed();
    let sessionError;
    try { state.user = (await api("/api/auth/session")).user; }
    catch (reason) { sessionError = reason.message; }
    await hydrate();
    if (sessionError) state.failures.session = sessionError;
    state.ready = true;
    render();
    schedule();
  } catch (reason) {
    write(root, unavailable("QuestFit пока недоступен", reason.message));
  }
}

function schedule() {
  clearTimeout(timer);
  const now = Date.now();
  const nextEvent = state.catalog.events.find(event => event.startAt > now)?.startAt;
  const deadline = Math.min(questPeriod(now).endsAt, nextEvent ?? Infinity);
  timer = setTimeout(syncTime, Math.max(1, deadline - now + 30));
}

async function syncTime() {
  const dayChanged = state.activity.questDay !== questPeriod().day;
  if (dayChanged) {
    if (state.user) await refresh(["activity"]);
    else state.activity = localActivity();
  }
  const section = route().section;
  if (!activeRequests && (["arena", "quests", "overview"].includes(section) || route().view === "notifications")) {
    if (route().view !== "event/join") render();
  }
  schedule();
}

function closeMenu(focus = false) {
  const trigger = root.querySelector(".portal-menu-button");
  if (!trigger) return;
  root.querySelector(".portal-sidebar").classList.remove("is-open");
  root.querySelector(".portal-scrim").hidden = true;
  trigger.setAttribute("aria-expanded", "false");
  if (focus) trigger.focus();
}

function navigate(to) {
  if (route().raw !== to) {
    location.hash = to;
    return;
  }
  render();
}

function inlineError(target, message) {
  const scope = target.closest("form") ?? root.querySelector("#screen");
  const output = scope?.querySelector("[data-error]");
  if (output) {
    output.hidden = !message;
    output.textContent = message;
  } else if (message) notice(message, true);
}

async function perform(target, task) {
  if (activeRequests) return;
  const scope = target.closest("form") ?? root.querySelector("#screen") ?? root;
  const disabled = [...scope.querySelectorAll("button")].filter(control => !control.disabled);
  disabled.forEach(control => { control.disabled = true; });
  activeRequests++;
  inlineError(target, "");
  const original = route().raw;
  try {
    const result = await task();
    if (route().raw === original) {
      if (result?.to) navigate(result.to);
      else render();
    } else if (route().section === "overview") render();
    if (result?.message) notice(result.message);
    schedule();
  } catch (reason) {
    if (route().raw === original) inlineError(target, reason.message);
    else notice(reason.message, true);
  } finally {
    activeRequests--;
    disabled.forEach(control => { control.disabled = false; });
    updateSaveButton(scope);
  }
}

async function eventAction(id, action, registered) {
  state.activity = await api("/api/activity", "POST", { action, eventSlug: id, registered });
  await refresh(["catalog"]);
}

async function teamAction(action, data, to) {
  state.team = (await api("/api/team", "POST", { action, ...data })).team;
  ui.confirm = null;
  return {to, message: action === "contribute" ? "Вклад добавлен" : "Команда обновлена"};
}

async function adminAction(data, reset) {
  state.admin = await api("/api/admin", "POST", data);
  ui.confirm = null;
  if (reset) ui.selected = null;
  await refresh(state.user ? ["catalog", "activity"] : ["catalog"]);
  return {message: "Изменения сохранены"};
}

function checkText(value, length, message) {
  if (value.length < length) throw new Error(message);
  return value;
}

const forms = {
  auth: async (page, data) => {
    const fullName = (data.fullName ?? "").trim().replace(/\s+/g, " ");
    if (page.view === "register") checkText(fullName, 2, "Укажите имя.");
    state.user = (await api("/api/auth/" + page.view, "POST", {...data, fullName, email: data.email.trim().toLowerCase()})).user;
    await hydrate();
    return {to: page.next, message: page.view === "register" ? "Аккаунт создан" : "С возвращением"};
  },
  workout: async (page, data) => {
    const now = Date.now();
    const today = localDate(new Date(now));
    const performedAt = data.date === today ? now : Date.parse(data.date + "T12:00:00");
    const title = checkText(data.title.trim(), 2, "Укажите название тренировки.");
    const {workout} = await api("/api/workouts", "POST", {
      title, performedAt, type: page.step, durationMinutes: Number(data.durationMinutes), distanceKm: Number(data.distanceKm),
      calories: Number(data.calories), notes: data.notes.trim(),
    });
    await refresh(["dashboard"]);
    return {to: "workout/" + workout.id, message: "Тренировка записана · +" + workout.xp + " XP"};
  },
  profile: async (page, data, form) => {
    const update = {...state.dashboard.preferences, fullName: state.user.fullName, goal: state.user.goal};
    if (page.view === "goal") update.weeklyGoalMinutes = Number(data.weeklyGoalMinutes);
    else if (page.view === "notifications") update.notificationsEnabled = form.elements.notificationsEnabled.checked;
    else for (const fieldName of ["fullName", "city", "goal"]) update[fieldName] = checkText(data[fieldName].trim(), 2, "Проверьте имя, город и цель.");
    const {user, preferences} = await api("/api/profile", "PATCH", update);
    state.user = user;
    state.dashboard = {...state.dashboard, preferences};
    await refresh(["dashboard", "team"]);
    return {message: "Настройки сохранены"};
  },
  "team-create": (page, data) => teamAction("create", {
    name: checkText(data.name.trim(), 2, "Укажите название команды."), goalKm: Number(data.goalKm),
  }, "team/roster"),
  "team-join": (page, data) => teamAction("join", {code: data.code.trim().toUpperCase()}, "team/roster"),
  "team-contribute": (page, data) => teamAction("contribute", {distanceKm: Number(data.distanceKm)}, "team"),
  "event-join": async page => {
    await eventAction(page.id, "event", true);
    return {to: "event/" + page.id, message: "Участие подтверждено"};
  },
  admin: (page, data) => {
    const isQuest = page.id === "quests";
    const verb = ui.selected === null ? "create" : "update";
    const title = checkText(data.title.trim(), 2, "Укажите название.");
    const values = {action: verb + (isQuest ? "Quest" : "Event"), id: ui.selected, title, active: data.active === "on"};
    if (isQuest) {
      values.detail = checkText(data.detail.trim(), 2, "Укажите условие квеста.");
      values.xp = Number(data.xp);
    } else {
      Object.assign(values, {
        location: checkText(data.location.trim(), 2, "Укажите место старта."),
        startAt: Date.parse(data.startAt), distanceKm: Number(data.distanceKm),
        capacity: Number(data.capacity), rewardXp: Number(data.rewardXp),
      });
      if (verb === "create") values.slug = "event-" + crypto.randomUUID().slice(0, 12);
    }
    return adminAction(values, verb === "create");
  },
};

root.addEventListener("submit", event => {
  const form = event.target;
  event.preventDefault();
  const handler = forms[form.dataset.form];
  if (typeof handler !== "function") return;
  if (form.hasAttribute("data-requires-change") && !formChanged(form)) return;
  const page = route();
  const data = Object.fromEntries(new FormData(form));
  void perform(form, () => handler(page, data, form));
});

function formChanged(form) {
  return Array.from(form.elements).some(control => {
    if (!control.name) return false;
    if (control.type === "checkbox") return control.checked !== control.defaultChecked;
    if (control.type === "number" && control.value !== "") return control.valueAsNumber !== Number(control.defaultValue);
    return control.value.trim() !== control.defaultValue.trim();
  });
}

function updateSaveButton(form) {
  if (form.hasAttribute("data-requires-change")) {
    form.querySelector('[type="submit"]').disabled = Boolean(activeRequests) || !formChanged(form);
  }
}

function goalButtons(value) {
  root.querySelectorAll('[data-action="goal-preset"]').forEach(control => {
    control.setAttribute("aria-pressed", String(control.dataset.value === String(value)));
  });
}

root.addEventListener("input", event => {
  const control = event.target;
  const form = control.form;
  if (!form) return;
  updateSaveButton(form);
  if (form.dataset.form === "filters") {
    write(root.querySelector("#workout-results"),
      filteredWorkouts(state.dashboard.workouts, Object.fromEntries(new FormData(form)), Date.now()));
  } else if (form.dataset.form === "workout") {
    const xp = calculateWorkoutXp({durationMinutes: Number(form.elements.durationMinutes.value), distanceKm: Number(form.elements.distanceKm.value)});
    root.querySelector("#workout-preview").textContent = "+" + (xp || 0) + " XP";
  } else if (control.name === "weeklyGoalMinutes") goalButtons(control.value);
  else if (control.name === "showPassword") form.elements.password.type = control.checked ? "text" : "password";
  else if (form.dataset.form === "team-contribute") {
    const distance = Number(control.value) || 0;
    root.querySelector("#team-preview").textContent = teamPreview(state.team, distance);
    root.querySelector("#team-preview-meter progress").value = (state.team.totalKm + distance) / state.team.goalKm * 100;
  }
});

const actions = {
  skip: () => root.querySelector("#main-content")?.focus(),
  menu: () => {
    const trigger = root.querySelector(".portal-menu-button");
    if (trigger.getAttribute("aria-expanded") === "true") closeMenu(true);
    else {
      root.querySelector(".portal-sidebar").classList.add("is-open");
      root.querySelector(".portal-scrim").hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      root.querySelector(".portal-mobile-close").focus();
    }
  },
  "menu-close": () => closeMenu(true),
  reload: () => location.reload(),
  "reload-catalog": (page, control) => perform(control, () => refresh(["catalog"])),
  "goal-preset": (page, control) => {
    const input = root.querySelector('[name="weeklyGoalMinutes"]');
    input.value = control.dataset.value;
    input.dispatchEvent(new Event("input", {bubbles: true}));
  },
  period: (page, control) => { ui.period = Number(control.dataset.value); render(); },
  earned: () => { ui.earned = !ui.earned; render(); },
  "quests-filter": (page, control) => { ui.questFilter = control.dataset.value; render(); },
  "arena-filter": (page, control) => { ui.arenaFilter = control.dataset.value; render(); },
  "ask-delete-workout": () => { ui.confirm = true; render(); },
  "ask-finish": () => { ui.confirm = true; render(); },
  dismiss: () => { ui.confirm = null; render(); },
  "delete-workout": (page, control) => perform(control, async () => {
    await api("/api/workouts?id=" + Number(page.id), "DELETE");
    await refresh(["dashboard"]);
    return {to: "workouts", message: "Запись удалена"};
  }),
  "quest-toggle": (page, control) => perform(control, async () => {
    const id = Number(page.id);
    const quest = state.catalog.quests.find(item => item.id === id);
    const completed = !props().completed.includes(id);
    state.activity = state.user ? await api("/api/activity", "POST", {action: "quest", questId: id, completed})
      : localQuest(false, quest, completed);
    return {message: completed ? "Квест выполнен · +" + quest.xp + " XP" : "Отметка снята"};
  }),
  "cancel-booking": (page, control) => perform(control, async () => {
    await eventAction(page.id, "event", false);
    return {message: "Запись отменена"};
  }),
  "finish-event": (page, control) => perform(control, async () => {
    await eventAction(page.id, "finishEvent");
    ui.confirm = null;
    const finish = state.activity.finishedEvents.find(item => item.slug === page.id);
    return {message: "Финиш отмечен · +" + finish.xp + " XP"};
  }),
  logout: (page, control) => perform(control, async () => {
    await api("/api/auth/logout", "POST");
    state.user = null;
    await hydrate();
    return {to: "login", message: "Вы вышли из аккаунта"};
  }),
  "copy-code": async () => {
    try { await navigator.clipboard.writeText(state.team.code); notice("Код скопирован"); }
    catch { notice("Код команды: " + state.team.code); }
  },
  "ask-transfer": (page, control) => confirmMember(control, "transfer", "Передать лидерство участнику"),
  "ask-kick": (page, control) => confirmMember(control, "kick", "Исключить участника"),
  "ask-leave": () => { ui.confirm = {action: "leave", description: "Покинуть команду?"}; render(); },
  "confirm-team": (page, control) => perform(control, () => {
    const {action, userId} = ui.confirm;
    return teamAction(action, {userId}, action === "leave" ? "team" : undefined);
  }),
  "admin-new": () => { ui.selected = null; ui.confirm = null; render(); root.querySelector('[name="title"]')?.focus(); },
  "admin-select": (page, control) => { ui.selected = Number(control.dataset.value); ui.confirm = null; render(); },
  "ask-admin-delete": (page, control) => showAdminDelete(control.form, true),
  "dismiss-admin-delete": (page, control) => showAdminDelete(control.form, false),
  "admin-delete": (page, control) => perform(control,
    () => adminAction({action: page.id === "quests" ? "deleteQuest" : "deleteEvent", id: ui.selected}, true)),
};

function showAdminDelete(form, visible) {
  const trigger = form.querySelector('[data-action="ask-admin-delete"]');
  const confirmation = form.querySelector("[data-admin-delete]");
  trigger.hidden = visible;
  confirmation.hidden = !visible;
  const focus = visible ? confirmation.querySelector('[data-action="dismiss-admin-delete"]') : trigger;
  focus.focus();
}

function confirmMember(control, action, verb) {
  const userId = Number(control.dataset.value);
  const member = state.team.members.find(item => item.userId === userId);
  if (!member) return;
  ui.confirm = { action, userId, description: verb + " «" + member.name + "»?" };
  render();
}

root.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (control) {
    event.preventDefault();
    const action = actions[control.dataset.action];
    if (typeof action === "function") void action(route(), control);
  } else if (event.target.closest(".portal-sidebar a")) closeMenu();
});

window.addEventListener("hashchange", () => {
  ui = initialUI();
  closeMenu();
  render();
  scrollTo(0, 0);
});
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && root.querySelector(".portal-sidebar.is-open")) closeMenu(true);
});
window.addEventListener("focus", () => { if (state.ready) void syncTime(); });

if (navigator.modelContext?.registerTool) {
  try {
    const result = navigator.modelContext.registerTool({
      name: "complete_daily_quest", title: "Завершить квест", description: "Отмечает видимый квест QuestFit выполненным.",
      inputSchema: {type: "object", properties: {questId: {type: "integer", minimum: 1}}, required: ["questId"], additionalProperties: false},
      annotations: {readOnlyHint: false, untrustedContentHint: false},
      async execute({questId}) {
        const quest = state.catalog.quests.find(item => item.id === questId);
        if (!quest) throw new Error("Неизвестный квест.");
        state.activity = state.user ? await api("/api/activity", "POST", {action: "quest", questId, completed: true})
          : localQuest(false, quest, true);
        if (["overview", "quests"].includes(route().section)) render();
        return {questId, title: quest.title, status: "completed", xp: quest.xp, saved: true, scope: state.user && !demoMode ? "account" : "browser"};
      },
    });
    Promise.resolve(result).catch(() => {});
  } catch { /* Optional browser integration. */ }
}

void start();
