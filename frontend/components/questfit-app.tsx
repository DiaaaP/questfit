"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Activity, Bell, CalendarDays, Dumbbell, Flame, LayoutDashboard, MapPin, Menu, ShieldCheck, Target, Trophy, UserRound, Users, X, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { workoutTypeLabels, type WorkoutType } from "@/shared/questfit";
import { AuthScreen, Brand, ProfileView } from "./account-views";
import { AdminSection } from "./admin-section";
import { ArenaCatalog, EventDetail, EventSignup, QuestCatalog, QuestDetail, QuestRows } from "./catalog-section";
import { Achievements, ActivityChoice, Leaderboard, ProgressSection, weeklyMinutes, WorkoutDetails, WorkoutForm, WorkoutJournal, WorkoutList } from "./progress-section";
import { TeamManager, useTeam } from "./team-manager";
import { Action, Empty, eventDateLabel, formatNumber as num, Go, Meter, NeedAccount, Stat, windowHash } from "./portal-ui";
import { useQuestFit } from "./use-questfit";

const paths = [
  { to: "overview", label: "Главная", icon: LayoutDashboard },
  { to: "quests", label: "Квесты", icon: Target },
  { to: "workouts", label: "Тренировки", icon: Dumbbell },
  { to: "progress", label: "Прогресс", icon: Activity },
  { to: "team", label: "Команда", icon: Users },
  { to: "arena", label: "Арена", icon: Trophy },
  { to: "profile", label: "Профиль", icon: UserRound },
  { to: "admin", label: "Администрирование", icon: ShieldCheck },
];

const pages: Record<string, [string, string]> = {
  overview: ["Главная", ""],
  quests: ["Квесты", "Выберите задание и получите опыт за выполнение."],
  quest: ["Квест", "Условия задания и награда за выполнение."],
  workouts: ["Журнал тренировок", "Все тренировки, дистанция и время в движении."],
  "workout/new": ["Вид активности", "Шаг 1 из 2 · Выберите тип тренировки."],
  "workout/metrics": ["Показатели тренировки", "Шаг 2 из 2 · Добавьте результаты."],
  workout: ["Детали тренировки", "Запись в журнале активности."],
  progress: ["Прогресс", "Сравните нагрузку и следите за недельной целью."],
  goal: ["Недельная цель", "Выберите количество минут активности на неделю."],
  achievements: ["Достижения", "Награды за регулярность и новые результаты."],
  leaderboard: ["Городской рейтинг", "Места участников по XP за тренировки."],
  team: ["Команда", "Общий прогресс, состав и приглашения."],
  "team/create": ["Создать команду", "Соберите состав и задайте цель общего рейда."],
  "team/join": ["Вступить в команду", "Воспользуйтесь кодом приглашения."],
  "team/roster": ["Состав команды", "Участники, роли и управление приглашением."],
  "team/raid": ["Командный рейд", "Суммарная дистанция команды и ваш вклад."],
  "team/contribute": ["Вклад в рейд", "Добавьте пройденную дистанцию к результату команды."],
  arena: ["Арена", "Календарь спортивных событий и ваши записи."],
  event: ["Детали события", "Дистанция, время старта и регистрация."],
  "event/join": ["Запись на событие", "Проверьте данные и подтвердите участие."],
  profile: ["Профиль", "Личные данные и настройки QuestFit."],
  notifications: ["Уведомления", "Активные напоминания и настройки показа."],
  admin: ["Администрирование", "Управление каталогом и просмотр пользователей."],
  "admin/quests": ["Редактор квестов", "Создавайте задания и обновляйте награды."],
  "admin/events": ["Редактор соревнований", "Планируйте старты и управляйте записью."],
  login: ["Вход в QuestFit", ""],
  register: ["Регистрация", ""],
};

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
function readRoute(raw: string) {
  const [path, search] = raw.split("?");
  const [root, id, step] = path.split("/");
  const view = root === "squad" ? "team" : root === "workout" && id === "new"
    ? step ? "workout/metrics" : "workout/new"
    : root === "event" && step === "join" ? "event/join"
    : (root === "team" || root === "admin") && id ? `${root}/${id}` : root;
  return { view, id, step, search: new URLSearchParams(search) };
}
function activeRoot(view: string) {
  if (view.startsWith("workout")) return "workouts";
  if (view.startsWith("quest")) return "quests";
  if (view.startsWith("event")) return "arena";
  if (["goal", "achievements", "leaderboard"].includes(view)) return "progress";
  if (view === "notifications") return "profile";
  return view.split("/")[0];
}

export function QuestFitApp() {
  const hash = useSyncExternalStore(subscribeHash, windowHash, () => "overview");
  const { view, id, step, search } = readRoute(hash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const fit = useQuestFit();
  const { user, ready, staticMode, dashboard, catalog, joined, completed, firstName } = fit;
  const team = useTeam(user, staticMode);
  const active = activeRoot(view);
  const [title, description] = Object.hasOwn(pages, view) ? pages[view] : ["Страница не найдена", ""];
  const selectedQuest = catalog.quests.find((quest) => quest.id === Number(id));
  const event = catalog.events.find((item) => item.slug === id);
  const nextStart = catalog.events.find((item) => item.startAt > now)?.startAt;
  const featured = catalog.events.find((item) => item.active && item.startAt > now);
  const reminders = catalog.events.filter((item) => joined.includes(item.slug) && item.startAt > now);
  const completedQuests = catalog.quests.filter((quest) => completed.includes(quest.id));
  const xp = dashboard.totals.workoutXp + fit.questXp + fit.eventXp;
  const level = Math.floor(xp / 400) + 1;
  const week = weeklyMinutes(dashboard.workouts);

  useEffect(() => {
    document.title = `${title} · QuestFit`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [hash, title]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = nextStart === undefined ? undefined : window.setTimeout(update,
      Math.min(Math.max(1, nextStart - Date.now()), 2_147_483_647));
    window.addEventListener("focus", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, [nextStart, now]);

  useEffect(() => {
    if (!mobileOpen) return;
    function close(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  if (view === "register" || view === "login") {
    const requested = search.get("next") || "overview";
    const requestedView = readRoute(requested).view;
    const next = /^[a-z0-9/-]+$/.test(requested) && Object.hasOwn(pages, requestedView) && !["login", "register"].includes(requestedView)
      ? requested : "overview";
    return <div className="qf-portal"><AuthScreen key={hash} mode={view} staticMode={staticMode} ready={ready} next={next} onAuth={fit.authenticate} /><Toaster position="bottom-right" /></div>;
  }

  const needsData = ["overview", "workouts", "workout", "progress", "goal", "achievements", "leaderboard", "profile", "notifications"].includes(view);
  let content;
  if (!ready || (user && needsData && !fit.dataReady)) content = <Empty title="Готовим QuestFit" text="Загружаем ваши данные." />;
  else if (user && needsData && fit.dataError) content = <Empty title="Данные пока недоступны" text={fit.dataError}><Action onClick={() => window.location.reload()}>Повторить</Action></Empty>;
  else if (view === "overview") content = <>
    <div className="portal-dashboard-top">
      <section className="portal-spotlight has-photo portal-hero"><div className="portal-spotlight-copy">
        <span className="portal-chip"><Flame size={16} aria-hidden="true" /> {user ? `${firstName}, ваш прогресс` : "Игровой фитнес-трекер"}</span>
        <h2>Твой следующий<br />уровень</h2><p>Записывайте тренировки, выполняйте квесты и двигайтесь к общей цели с командой.</p>
        <div className="portal-actions"><Go to="workout/new" primary><Zap size={17} aria-hidden="true" /> Записать тренировку</Go><Go to="quests">Смотреть квесты</Go></div>
      </div></section>
      <aside className="portal-panel portal-level">
        <div className="portal-section-head"><h2>Прогресс уровня</h2><Zap size={18} aria-hidden="true" /></div>
        <div className="portal-orbit" style={{ "--level-progress": `${xp % 400 / 4}%` } as CSSProperties}><div><strong>{level}</strong><span>Уровень</span></div></div>
        <p><b>{num(xp)} XP</b><span>Ещё {400 - xp % 400} XP</span></p><Meter value={xp % 400 / 4} label="Прогресс до следующего уровня" />
        <Go to="progress">Мой прогресс</Go>
      </aside>
    </div>
    <div className="portal-stat-grid">
      <Stat label="В движении на неделе" value={`${week} мин`} detail={`Цель · ${dashboard.preferences.weeklyGoalMinutes} мин`} />
      <Stat label="Квесты выполнены" value={`${completedQuests.length} / ${catalog.quests.length}`} detail="В доступном каталоге" />
      <Stat label="Моя команда" value={team.team?.name ?? "Свободный атлет"} detail={team.team ? `${num(team.team.totalKm)} км в рейде` : "Создайте команду или вступите в неё"} />
    </div>
    <div className="portal-columns">
      <section className="portal-panel"><div className="portal-section-head"><h2>Квесты на сегодня</h2><Go to="quests">Все квесты</Go></div>
        <QuestRows quests={catalog.quests.slice(0, 4)} completed={completed} /></section>
      <section className="portal-panel portal-side-info"><span className="portal-icon activity-run"><CalendarDays size={22} aria-hidden="true" /></span><h2>Арена</h2>
        {featured ? <><strong>{featured.title}</strong><p>{eventDateLabel(featured.startAt)} · {num(featured.distanceKm)} км</p><Go to={`event/${featured.slug}`}>Детали старта</Go></>
          : <><p>Новые старты появятся в календаре.</p><Go to="arena">Календарь</Go></>}</section>
    </div>
    {dashboard.workouts.length > 0 && <section className="portal-panel"><div className="portal-section-head"><h2>Последние тренировки</h2><Go to="workouts">Журнал</Go></div><WorkoutList workouts={dashboard.workouts.slice(0, 3)} /></section>}
  </>;
  else if (view === "quests") content = <QuestCatalog quests={catalog.quests} completed={completed} todayXp={fit.todayQuestXp} />;
  else if (view === "quest") content = <QuestDetail quest={selectedQuest} done={Boolean(selectedQuest && completed.includes(selectedQuest.id))} pending={fit.questPending} onToggle={() => selectedQuest && void fit.saveQuest(selectedQuest, !completed.includes(selectedQuest.id))} />;
  else if (view === "workouts") content = <WorkoutJournal workouts={dashboard.workouts} />;
  else if (view === "workout") content = <WorkoutDetails workout={dashboard.workouts.find((entry) => entry.id === Number(id))} onDelete={fit.deleteWorkout} editable={Boolean(user)} />;
  else if (view === "workout/new" || view === "workout/metrics") content = user
    ? step && Object.hasOwn(workoutTypeLabels, step) ? <WorkoutForm type={step as WorkoutType} onSave={fit.saveWorkout} /> : <ActivityChoice />
    : <NeedAccount description="Аккаунт нужен для журнала и сохранения результатов тренировок." />;
  else if (view === "progress") content = <ProgressSection dashboard={dashboard} />;
  else if (view === "achievements") content = <Achievements dashboard={dashboard} />;
  else if (view === "leaderboard") content = <Leaderboard dashboard={dashboard} demo={!user || staticMode} />;
  else if (view === "arena") content = <ArenaCatalog events={catalog.events} joined={joined} finished={fit.finishedEvents} now={now} />;
  else if (view === "event") content = <EventDetail key={id} event={event} joined={joined.includes(id ?? "")} finished={fit.finishedEvents.find((entry) => entry.slug === id)} now={now}
    onCancel={() => event ? fit.registerForEvent(event, false) : Promise.reject(new Error("Событие недоступно."))}
    onFinish={() => event ? fit.saveEventFinish(event) : Promise.reject(new Error("Событие недоступно."))} />;
  else if (view === "event/join") content = !user ? <NeedAccount description="Войдите, чтобы сохранить место на старте." /> : event && joined.includes(event.slug)
    ? <Empty title="Вы уже записаны" text="Детали участия доступны на странице события."><Go to={`event/${event.slug}`}>К событию</Go></Empty>
    : <EventSignup event={event} user={user} now={now} onRegister={() => event ? fit.registerForEvent(event, true) : Promise.reject(new Error("Событие недоступно."))} />;
  else if (view === "team" || view.startsWith("team/")) content = <TeamManager user={user} staticMode={staticMode} view={id ?? "home"} {...team} />;
  else if (view === "admin" || view.startsWith("admin/")) content = <AdminSection view={id ?? "home"} user={user} staticMode={staticMode} onChange={fit.refreshCatalog} />;
  else if (view === "profile" || view === "goal" || view === "notifications") content = user
    ? <ProfileView view={view} user={user} dashboard={dashboard} week={week} reminders={reminders} onSave={fit.saveProfile} onLogout={fit.logout} />
    : <NeedAccount description="Личные настройки и напоминания доступны после входа." />;
  else content = <Empty title="Страница не найдена" text="Выберите нужный раздел в меню."><Go to="overview" primary>На главную</Go></Empty>;

  const admin = Boolean(user && (staticMode || user.id === 1));
  const navItems = paths.filter((item) => item.to !== "admin" || admin);
  const initials = user?.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="qf-portal">
    <a className="portal-skip" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>К содержимому</a>
    {mobileOpen && <button className="portal-scrim" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
    <aside className={`portal-sidebar ${mobileOpen ? "is-open" : ""}`} id="portal-navigation">
      <a className="portal-brand-link" href="#overview" onClick={() => setMobileOpen(false)} aria-label="QuestFit, главная"><Brand /></a>
      <button className="portal-mobile-close portal-icon-button" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)}><X size={21} aria-hidden="true" /></button>
      <nav aria-label="Основная навигация">{navItems.map(({ to, label, icon: Icon }) =>
        <a key={to} href={`#${to}`} aria-current={active === to ? "page" : undefined} onClick={() => setMobileOpen(false)}><Icon size={19} aria-hidden="true" />{label}</a>)}</nav>
      <div className="portal-sidebar-bottom"><span className="portal-sidebar-label"><MapPin size={16} aria-hidden="true" /> {dashboard.preferences.city}</span>
        <a className="portal-sidebar-identity" href={user ? "#profile" : "#login"} onClick={() => setMobileOpen(false)}><span className="portal-avatar">{initials || <UserRound size={18} aria-hidden="true" />}</span><span><strong>{user?.fullName ?? "Гость"}</strong><small>{user ? `Уровень ${level}` : "Войти в QuestFit"}</small></span></a></div>
    </aside>
    <main className="portal-main" id="main-content" tabIndex={-1}>
      <header className="portal-top">
        <div className="portal-title-wrap"><button className="portal-icon-button portal-menu-button" aria-label="Открыть меню" aria-controls="portal-navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21} aria-hidden="true" /></button>
          <div><h1>{title}</h1>{description && <p>{description}</p>}</div></div>
        <div className="portal-actions portal-top-actions">
          {user ? <><a href="#notifications" className="portal-icon-button" aria-label="Уведомления"><Bell size={19} aria-hidden="true" />{dashboard.preferences.notificationsEnabled && reminders.length > 0 && <i />}</a>
            <a href="#profile" className="portal-avatar" aria-label="Профиль">{initials}</a></> : <><Go to="login">Войти</Go><Go to="register" primary>Создать аккаунт</Go></>}
        </div>
      </header>
      {ready && !user && view === "overview" && <div className="portal-demo-note"><span className="portal-chip">Демо</span> Пример прогресса. Создайте аккаунт, чтобы вести свой журнал.</div>}
      {fit.accountError && <div className="portal-alert" role="status">{fit.accountError}</div>}
      {fit.catalogError && ["overview", "quests", "arena"].includes(active) && <div className="portal-alert"><span>Каталог временно недоступен. Показаны примеры.</span><Action onClick={fit.refreshCatalog}>Обновить</Action></div>}
      <div className="portal-content" key={hash}>{content}</div>
      <footer className="portal-footer"><strong>QuestFit</strong><span>{staticMode ? "Браузерное демо · данные на этом устройстве" : "Тренировки, квесты и спортивные старты"}</span></footer>
    </main>
    <Toaster position="bottom-right" />
  </div>;
}
