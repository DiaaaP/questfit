import { back, button, dateLabel, empty, error, field, go, html, icon, localDate, mark, meter, num, rows, stat, submit, weekMinutes } from "./ui.js";
import { calculateWorkoutXp, workoutTypeLabels } from "./workout-data.js";

const icons = { run: "Activity", strength: "Dumbbell", walk: "Footprints", cycling: "Bike", mobility: "Timer" };
const hints = {
  run: "Темп, дистанция и выносливость", walk: "Спокойная или быстрая прогулка",
  cycling: "Велосипед, велотренажёр или трейл", strength: "Зал, силовые и упражнения с весом",
  mobility: "Растяжка, восстановление и работа с подвижностью",
};
const activityMark = type => mark(type, icons[type]);

export function workoutRows(workouts) {
  return rows(workouts.map(workout => html`<a class="portal-row" href="#workout/${workout.id}">
    ${activityMark(workout.type)}
    <span><strong>${workout.title}</strong><small>${dateLabel(workout.performedAt)} · ${workoutTypeLabels[workout.type]}</small></span>
    <span class="portal-row-end"><strong>${workout.durationMinutes} мин</strong><small>${workout.distanceKm ? num(workout.distanceKm) + " км · " : ""}+${workout.xp} XP</small></span>
  </a>`));
}

export function filteredWorkouts(workouts, values, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(values.period) - 1));
  const query = values.query.trim().toLocaleLowerCase("ru");
  const filtered = workouts.filter(workout =>
    (values.type === "all" || workout.type === values.type) &&
    (values.period === "all" || workout.performedAt >= start.getTime()) &&
    workout.title.toLocaleLowerCase("ru").includes(query)
  );
  return filtered.length ? workoutRows(filtered) : html`<p class="portal-muted">${workouts.length ? "По этим фильтрам ничего не найдено." : "Здесь появится первая записанная тренировка."}</p>`;
}

export function journal(workouts, now) {
  return html`<div class="portal-stat-grid">
    ${stat("За неделю", weekMinutes(workouts, now) + " мин", "С понедельника")}
    ${stat("Тренировки в журнале", workouts.length)}
    ${stat("Дистанция в журнале", num(workouts.reduce((sum, item) => sum + item.distanceKm, 0)) + " км")}
  </div>
  <section class="portal-panel">
    <div class="portal-section-head"><h2>История тренировок</h2>${go("workout/new", "Добавить тренировку", true)}</div>
    <form class="portal-filters" data-form="filters">
      <input name="query" aria-label="Поиск тренировок" type="search" placeholder="Найти по названию">
      <select name="type" aria-label="Вид активности"><option value="all">Все активности</option>
        ${Object.entries(workoutTypeLabels).map(([key, name]) => html`<option value="${key}">${name}</option>`)}
      </select>
      <select name="period" aria-label="Период"><option value="all">Всё время</option><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option></select>
    </form>
    <div id="workout-results" aria-live="polite">${filteredWorkouts(workouts, { type: "all", period: "all", query: "" }, now)}</div>
  </section>`;
}

export function activityChoice() {
  return html`${back("workouts", "Журнал тренировок")}
    <div class="portal-step"><span class="is-current">Вид активности</span><span>Показатели</span></div>
    <div class="portal-choice-grid">${Object.entries(workoutTypeLabels).map(([type, label]) => html`
      <a class="portal-panel portal-choice" href="#workout/new/${type}">${activityMark(type)}<strong>${label}</strong><small>${hints[type]}</small></a>
    `)}</div>`;
}

export function workoutForm(type, now) {
  const today = localDate(new Date(now));
  return html`${back("workout/new", "Вид активности")}
  <div class="portal-step"><span>${workoutTypeLabels[type]}</span><span class="is-current">Показатели</span></div>
  <div class="portal-columns">
    <form class="portal-panel portal-form" data-form="workout">
      ${field("Название", html`<input name="title" placeholder="Например, лёгкая пробежка" required minlength="2" maxlength="80">`)}
      ${field("Дата", html`<input name="date" type="date" value="${today}" max="${today}" required>`)}
      <div class="portal-form-pair">
        ${field("Длительность, мин", html`<input name="durationMinutes" type="number" value="30" min="5" max="600" required>`)}
        ${field("Дистанция, км", html`<input name="distanceKm" type="number" min="0" max="300" step=".01" placeholder="0">`)}
      </div>
      ${field("Энергозатраты, ккал", html`<input name="calories" type="number" min="0" max="10000" placeholder="Необязательно">`)}
      ${field("Заметка", html`<textarea name="notes" rows="3" maxlength="300" placeholder="Как прошла тренировка?"></textarea>`)}
      ${error}${submit("Сохранить тренировку")}
    </form>
    <aside class="portal-panel portal-side-info">${activityMark(type)}<h2>${workoutTypeLabels[type]}</h2>
      <p>Запись попадёт в журнал и обновит вашу недельную цель.</p>
      <div class="portal-xp">${icon("Zap", 17)} <span id="workout-preview">+${calculateWorkoutXp({durationMinutes: 30, distanceKm: 0})} XP</span></div>
    </aside>
  </div>`;
}

export function workoutDetail(workout, member, confirmation) {
  if (!workout) return empty("Тренировка не найдена", "Откройте другую запись в журнале.", go("workouts", "К журналу"));
  const pace = workout.distanceKm ? Math.round(workout.durationMinutes * 60 / workout.distanceKm) : 0;
  return html`${back("workouts", "Журнал тренировок")}
    <div class="portal-stat-grid">
      ${stat("Длительность", workout.durationMinutes + " мин")}
      ${stat("Дистанция", num(workout.distanceKm) + " км", pace ? Math.floor(pace / 60) + ":" + String(pace % 60).padStart(2, "0") + " мин/км" : "")}
      ${stat("Опыт", "+" + workout.xp + " XP", workout.calories + " ккал")}
    </div>
    <section class="portal-panel portal-side-info">${activityMark(workout.type)}<h2>${workout.title}</h2>
      <p>${dateLabel(workout.performedAt)} · ${workoutTypeLabels[workout.type]}</p>
      ${workout.notes && html`<p class="portal-note">${workout.notes}</p>`}
      <div class="portal-actions">${go("progress", "Смотреть прогресс", true)}
        ${member && !confirmation && button("ask-delete-workout", "Удалить запись", { danger: true })}
      </div>
      ${confirmation && html`<div class="portal-confirm"><p>Удалить тренировку из журнала и пересчитать XP?</p><div class="portal-actions">
        ${button("delete-workout", "Удалить", { danger: true })}${button("dismiss", "Отмена")}
      </div></div>`}
      ${error}
    </section>`;
}

export function segment(action, value, current, text) {
  return html`<button type="button" data-action="${action}" data-value="${value}" aria-pressed="${String(value === current)}">${text}</button>`;
}

export function progress(dashboard, now, period) {
  const today = new Date(now);
  const byDate = new Map();
  for (const workout of dashboard.workouts) {
    const date = localDate(new Date(workout.performedAt));
    byDate.set(date, (byDate.get(date) ?? 0) + workout.durationMinutes);
  }
  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - period + index + 1);
    const key = localDate(date);
    return { key, label: period === 7 ? date.toLocaleDateString("ru-RU", {weekday: "short"}) : date.getDate(), total: byDate.get(key) ?? 0 };
  });
  const peak = Math.max(1, ...days.map(day => day.total));
  const week = weekMinutes(dashboard.workouts, now);
  const goal = dashboard.preferences.weeklyGoalMinutes;
  return html`<div class="portal-stat-grid">
    ${stat("Текущая неделя", week + " / " + goal + " мин", week >= goal ? "Цель достигнута" : "До цели " + (goal - week) + " мин")}
    ${stat("За " + period + " дней", days.reduce((sum, day) => sum + day.total, 0) + " мин")}
    ${stat("XP за тренировки", num(dashboard.totals.workoutXp))}
  </div>
  <section class="portal-panel">
    <div class="portal-section-head"><h2>Время в движении</h2><div class="portal-segments">${[7, 30].map(value => segment("period", value, period, value + " дней"))}</div></div>
    <div class="portal-chart" role="group" aria-label="Минуты активности по дням">
      ${days.map(({ key, label, total }, index) => html`<div class="portal-bar" title="${key}: ${total} мин" aria-label="${key}: ${total} мин">
        <div><span class="${index === days.length - 1 ? "current" : ""}" style="height:${total / peak * 100}%"></span></div>
        <small>${period === 7 || index % 5 === 0 || index === days.length - 1 ? label : " "}</small>
      </div>`)}
    </div>
  </section>
  <div class="portal-columns is-balanced">
    <section class="portal-panel portal-side-info">${icon("TrendingUp", 22)}<h2>Недельная цель</h2>${meter(week / goal * 100, "Выполнение недельной цели")}${go("goal", "Изменить цель")}</section>
    <section class="portal-panel portal-side-info">${icon("Medal", 22)}<h2>Результаты</h2><div class="portal-actions">${go("achievements", "Достижения")}${go("leaderboard", "Рейтинг")}</div></section>
  </div>`;
}

export function achievements(dashboard, onlyUnlocked) {
  const earned = dashboard.achievements.filter(item => item.unlocked).length;
  return html`<section class="portal-panel">
    <div class="portal-section-head"><h2>Награды ${earned} / ${dashboard.achievements.length}</h2>
      <button type="button" class="portal-button" aria-pressed="${onlyUnlocked}" data-action="earned">${onlyUnlocked ? "Показать все" : "Только полученные"}</button>
    </div>
    <div class="portal-choice-grid">${dashboard.achievements.filter(item => !onlyUnlocked || item.unlocked).map(item => html`
      <article class="portal-choice portal-tile">
        ${mark(item.unlocked ? "strength" : "", "Medal")}
        <strong>${item.title}</strong><small>${item.description}</small>${meter(item.progress, item.title)}
        <small>${item.unlocked ? "Получено" : item.progress + "% выполнено"}</small>
      </article>
    `)}</div>
    ${onlyUnlocked && !earned && html`<p class="portal-muted">Запишите тренировку, чтобы получить первую награду.</p>`}
  </section>`;
}

export function leaderboard(dashboard, demo) {
  const entries = [...dashboard.leaderboard].sort((a, b) => b.xp - a.xp);
  return html`<section class="portal-panel">
    <div class="portal-section-head"><h2>Рейтинг · ${dashboard.preferences.city}</h2>${demo && html`<span class="portal-chip">Демо</span>`}</div>
    ${!entries.length && html`<p class="portal-muted">Пока нет результатов для этого города.</p>`}
    ${rows(entries.map((item, index) => html`<div class="portal-row ${item.currentUser ? "is-me" : ""}">
      <span class="portal-rank">${index + 1}</span><span><strong>${item.name}</strong>${item.currentUser && html`<small>Ваш результат</small>`}</span>
      <strong class="portal-row-end">${num(item.xp)} XP</strong>
    </div>`))}
  </section>`;
}
