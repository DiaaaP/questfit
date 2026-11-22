import { back, button, empty, error, eventDate, go, html, icon, mark, meter, num, rows, stat, submit } from "./ui.js";
import { segment, workoutRows } from "./training.js";

const questIcons = { strength: "Dumbbell", run: "Activity", walk: "Footprints", team: "Users", custom: "Target" };
const questCategories = { strength: "Силовая", run: "Бег", walk: "Ходьба", team: "Команда", custom: "Задание" };

export function questRows(quests, completed) {
  return rows(quests.map(quest => html`<a class="portal-row" href="#quest/${quest.id}">
    ${mark(quest.category, questIcons[quest.category])}
    <span><strong>${quest.title}</strong><small>${questCategories[quest.category]} · ${quest.detail}</small></span>
    <span class="portal-row-end ${completed.includes(quest.id) ? "portal-success" : "portal-ember"}">
      ${completed.includes(quest.id) && html`<span role="img" aria-label="Выполнен">${icon("Check", 15)}</span>`} +${quest.xp} XP
    </span>
  </a>`));
}

export function overview({ catalog, user, dashboard, team, completed, xp, level, featured, week }) {
  const count = catalog.quests.filter(quest => completed.includes(quest.id)).length;
  return html`<div class="portal-dashboard-top">
    <section class="portal-spotlight has-photo portal-hero"><div class="portal-spotlight-copy">
      <span class="portal-chip">${icon("Flame", 16)} ${user ? user.fullName.split(" ")[0] + ", ваш прогресс" : "Игровой фитнес-трекер"}</span>
      <h2>Твой следующий<br>уровень</h2><p>Записывайте тренировки, выполняйте квесты и двигайтесь к общей цели с командой.</p>
      <div class="portal-actions">${go("workout/new", html`${icon("Zap", 17)} Записать тренировку`, true)}</div>
    </div></section>
    <aside class="portal-panel portal-level">
      <div class="portal-section-head"><h2>Прогресс уровня</h2>${icon("Zap", 18)}</div>
      <div class="portal-orbit" style="--level-progress:${xp % 400 / 4}%"><div><strong>${level}</strong><span>Уровень</span></div></div>
      <p><b>${num(xp)} XP</b><span>Ещё ${400 - xp % 400} XP</span></p>${meter(xp % 400 / 4, "Прогресс до следующего уровня")}
      ${go("progress", "Мой прогресс")}
    </aside>
  </div>
  <div class="portal-stat-grid">
    ${stat("В движении на неделе", week + " мин", "Цель · " + dashboard.preferences.weeklyGoalMinutes + " мин")}
    ${stat("Квесты выполнены", count + " / " + catalog.quests.length, "В доступном каталоге")}
    ${stat("Моя команда", team?.name ?? "Свободный атлет", team ? num(team.totalKm) + " км в рейде" : "Создайте команду или вступите в неё")}
  </div>
  <div class="portal-columns">
    <section class="portal-panel"><div class="portal-section-head"><h2>Квесты на сегодня</h2>${go("quests", "Все квесты")}</div>
      ${questRows(catalog.quests.slice(0, 4), completed)}</section>
    <section class="portal-panel portal-side-info">${mark("run", "CalendarDays")}<h2>Арена</h2>
      ${featured ? html`<strong>${featured.title}</strong><p>${eventDate(featured.startAt)} · ${num(featured.distanceKm)} км</p>${go("event/" + featured.slug, "Детали старта")}`
        : html`<p>Новые старты появятся в календаре.</p>${go("arena", "Календарь")}`}</section>
  </div>
  ${dashboard.workouts.length > 0 && html`<section class="portal-panel"><div class="portal-section-head"><h2>Последние тренировки</h2>${go("workouts", "Журнал")}</div>${workoutRows(dashboard.workouts.slice(0, 3))}</section>`}`;
}

export function questCatalog(quests, completed, todayXp, filter) {
  const done = quests.filter(quest => completed.includes(quest.id)).length;
  const visible = quests.filter(quest => filter === "all" || completed.includes(quest.id) === (filter === "done"));
  return html`<div class="portal-stat-grid">${stat("Выполнено сегодня", done + " / " + quests.length)}${stat("XP за квесты сегодня", todayXp + " XP")}</div>
    <section class="portal-panel"><div class="portal-section-head"><h2>Доступные задания</h2><div class="portal-segments">
      ${segment("quests-filter", "all", filter, "Все")}${segment("quests-filter", "active", filter, "Активные")}${segment("quests-filter", "done", filter, "Выполненные")}
    </div></div>${questRows(visible, completed)}
    ${!visible.length && html`<p class="portal-muted">В этой категории пока нет квестов.</p>`}</section>`;
}

export function questDetail(quest, done) {
  if (!quest) return empty("Квест недоступен", "Выберите задание в каталоге.", go("quests", "Квесты"));
  return html`${back("quests", "Все квесты")}
    <section class="portal-spotlight"><div class="portal-spotlight-copy">${mark(quest.category, questIcons[quest.category])}
      <h2>${quest.title}</h2><p>${quest.detail}</p>
      <div class="portal-actions">${button("quest-toggle", done ? "Снять отметку" : "Отметить выполненным", { primary: true })}</div>
      ${error}
    </div></section>
    <div class="portal-stat-grid">${stat("Награда", "+" + quest.xp + " XP")}${stat("Статус", done ? "Выполнен" : "Активен")}</div>`;
}

export function arena({ catalog, featured, joined, finishes, now }, filter) {
  const visible = catalog.events.filter(event => filter === "mine" ? joined.includes(event.slug) : event.active);
  return html`${filter === "all" && featured && html`<section class="portal-spotlight has-photo"><div class="portal-spotlight-copy">
    <span class="portal-chip">${icon("CalendarDays", 16)} Ближайший старт</span><h2>${featured.title}</h2>
    <p>${eventDate(featured.startAt)} · ${num(featured.distanceKm)} км · ${featured.location}</p>
    <p>${featured.registrations < featured.capacity ? "Свободных мест: " + num(featured.capacity - featured.registrations) : "Все места заняты"}</p>
  </div></section>`}
  <section class="portal-panel"><div class="portal-section-head"><h2>Календарь арены</h2><div class="portal-segments">
    ${segment("arena-filter", "all", filter, "Все события")}${segment("arena-filter", "mine", filter, "Мои записи")}
  </div></div>
    ${rows(visible.map(event => html`<a class="portal-row" href="#event/${event.slug}">
      ${mark("run", "CalendarDays")}<span><strong>${event.title}</strong><small>${eventDate(event.startAt)} · ${event.location} · ${num(event.distanceKm)} км</small></span>
      <span class="portal-row-end">${finishes.some(item => item.slug === event.slug) ? "Финиш отмечен" : joined.includes(event.slug) ? "Вы записаны" : event.startAt > now ? "Предстоит" : "Старт прошёл"}</span>
    </a>`))}
    ${!visible.length && html`<p class="portal-muted">${filter === "mine" ? "У вас пока нет записей на старты." : "Новые старты появятся здесь."}</p>`}
  </section>`;
}

const noEvent = () => empty("Событие недоступно", "Проверьте актуальные старты в календаре.", go("arena", "Календарь"));
const openForBooking = (event, now) => event.active && event.startAt > now && event.registrations < event.capacity;

export function eventView(event, joined, finish, now, confirming) {
  if (!event) return noEvent();
  let actions = openForBooking(event, now) ? go("event/" + event.slug + "/join", "Записаться на старт", true)
    : html`<span class="portal-chip">Запись закрыта</span>`;
  if (finish) {
    actions = html`<span class="portal-chip portal-success">${icon("Check", 17)} Финиш отмечен · +${finish.xp} XP</span>`;
  } else if (joined) {
    actions = confirming ? html`<p>Подтвердите финиш, если вы прошли дистанцию.</p><div class="portal-actions">
      ${button("finish-event", "Подтвердить финиш", { primary: true })}${button("dismiss", "Отмена")}
    </div>` : html`<div class="portal-actions"><span class="portal-chip portal-success">${icon("Check", 17)} Вы записаны</span>
      ${event.startAt <= now && button("ask-finish", "Отметить финиш", { primary: true })}
      ${button("cancel-booking", "Отменить запись")}
    </div>`;
  }
  return html`${back("arena", "Календарь арены")}
    <section class="portal-spotlight has-photo"><div class="portal-spotlight-copy">
      <span class="portal-chip">${icon("MapPin", 16)} ${event.location}</span>
      <h2>${event.title}</h2><p>${eventDate(event.startAt)} · время Алматы</p>${actions}${error}
    </div></section>
    <div class="portal-stat-grid">${stat("Дистанция", num(event.distanceKm) + " км")}
      ${stat("Места", event.registrations + " / " + event.capacity)}
      ${stat(finish ? "Получено за финиш" : "Награда за финиш", "+" + (finish?.xp ?? event.rewardXp) + " XP")}
    </div>
    <section class="portal-panel portal-side-info">${icon("Route", 23)}<h2>Старт и маршрут</h2>
      <p>${event.location} · ${num(event.distanceKm)} км</p>${meter(event.registrations / event.capacity * 100, "Заполненность старта")}
    </section>`;
}

export function eventSignup(event, user, joined, now) {
  if (!event) return noEvent();
  if (joined) return empty("Вы уже записаны", "Детали участия доступны на странице события.", go("event/" + event.slug, "К событию"));
  if (!openForBooking(event, now)) return empty("Запись закрыта", "Проверьте другие старты в календаре.", go("arena", "Календарь"));
  return html`${back("event/" + event.slug, "Детали события")}
    <div class="portal-columns">
      <form class="portal-panel portal-form" data-form="event-join"><h2>Участник</h2>
        <div class="portal-summary-row"><span>Имя</span><strong>${user.fullName}</strong></div>
        <div class="portal-summary-row"><span>Почта</span><strong>${user.email}</strong></div>
        <label class="portal-check"><input type="checkbox" required> Я проверил дату и место старта и подтверждаю участие.</label>
        ${error}${submit("Подтвердить участие")}
      </form>
      <aside class="portal-panel portal-side-info">${icon("CalendarDays", 24)}<h2>${event.title}</h2>
        <p>${eventDate(event.startAt)} · ${event.location}</p>
        <span class="portal-chip">${icon("Swords", 15)} ${num(event.distanceKm)} км</span>
        <span class="portal-xp">${icon("Zap", 15)} ${event.rewardXp} XP за финиш</span>
      </aside>
    </div>`;
}
