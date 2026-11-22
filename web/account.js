import { back, brand, button, error, eventDate, field, go, html, icon, meter, rows, submit } from "./ui.js";
import { segment } from "./training.js";

export function authView(mode, demo, next) {
  const register = mode === "register";
  return html`<main class="portal-auth">
    <section class="portal-auth-photo">${brand()}
      <div><h2>Движение<br>начинается здесь.</h2><p>Тренировки, квесты и команда в одном месте.</p></div>
    </section>
    <section class="portal-auth-body">
      ${back("overview", "На главную")}<h1>${register ? "Создайте аккаунт" : "Вход в QuestFit"}</h1>
      <p>${register ? "Начните сохранять свои результаты." : "Продолжите с того места, где остановились."}</p>
      ${demo && html`<p class="portal-demo-note">Браузерное демо. Для него используйте отдельный пароль.</p>`}
      <form class="portal-form" data-form="auth">
        ${register && field("Имя", html`<input name="fullName" minlength="2" maxlength="60" autocomplete="name" placeholder="Как к вам обращаться" required>`)}
        ${field("Электронная почта", html`<input name="email" type="email" maxlength="160" autocomplete="email" placeholder="name@example.com" required>`)}
        ${field("Пароль", html`<input name="password" type="password" minlength="${register ? 8 : 1}" maxlength="128" autocomplete="${register ? "new-password" : "current-password"}" required>`, register && "Минимум 8 символов")}
        <label class="portal-check"><input type="checkbox" name="showPassword"> Показать пароль</label>
        ${error}${submit(register ? "Зарегистрироваться" : "Войти")}
      </form>
      <div class="portal-auth-switch">${register ? "Уже есть аккаунт?" : "Впервые в QuestFit?"}
        <a href="#${register ? "login" : "register"}?next=${encodeURIComponent(next)}">${register ? "Войти" : "Зарегистрироваться"}</a>
      </div>
    </section>
  </main>`;
}

export function account(view, { user, dashboard, reminders, week }) {
  const prefs = dashboard.preferences;
  let inputs, sidebar;
  if (view === "goal") {
    inputs = html`<h2>План на неделю</h2><div class="portal-segments">
      ${[90, 120, 150, 180].map(value => segment("goal-preset", value, prefs.weeklyGoalMinutes, value + " мин"))}
    </div>${field("Минуты в неделю", html`<input name="weeklyGoalMinutes" value="${prefs.weeklyGoalMinutes}" type="number" min="60" max="2000" required>`)}`;
    sidebar = html`${icon("Target", 24)}<h2>Текущая неделя</h2><p>${week} из ${prefs.weeklyGoalMinutes} минут</p>
      ${meter(week / prefs.weeklyGoalMinutes * 100, "Выполнение недельной цели")}`;
  } else if (view === "notifications") {
    inputs = html`<h2>Показ уведомлений</h2><label class="portal-switch">
      <span><strong>Напоминания о стартах</strong><small>События, на которые вы записались, появятся здесь и будут отмечены в меню.</small></span>
      <input name="notificationsEnabled" type="checkbox" role="switch" ${prefs.notificationsEnabled && "checked"}>
    </label>`;
    sidebar = html`${icon("Bell", 24)}<h2>Ближайшие старты</h2>
      ${prefs.notificationsEnabled && reminders.length ? rows(reminders.map(event => html`
        <a class="portal-row" href="#event/${event.slug}"><span><strong>${event.title}</strong><small>${eventDate(event.startAt)}</small></span></a>
      `)) : html`<p>${prefs.notificationsEnabled ? "Нет предстоящих стартов, на которые вы записаны." : "Напоминания отключены."}</p>`}`;
  } else {
    inputs = html`<h2>Личные данные</h2>
      ${field("Имя", html`<input name="fullName" value="${user.fullName}" minlength="2" maxlength="60" required>`)}
      ${field("Город", html`<input name="city" value="${prefs.city}" minlength="2" maxlength="80" required>`)}
      ${field("Фитнес-цель", html`<input name="goal" value="${user.goal}" minlength="2" maxlength="80" required>`)}`;
    sidebar = html`${icon("UserRound", 25)}<h2>${user.fullName}</h2><p>${user.email}</p><div class="portal-actions">
      ${go("goal", "Недельная цель")}${go("notifications", "Уведомления")}${button("logout", "Выйти", { danger: true })}
    </div>`;
  }
  return html`${view !== "profile" && back(view === "goal" ? "progress" : "profile", view === "goal" ? "Прогресс" : "Профиль")}
    <div class="portal-columns">
      <form class="portal-panel portal-form" data-form="profile" data-requires-change>${inputs}${error}${submit("Сохранить изменения", true)}</form>
      <aside class="portal-panel portal-side-info">${sidebar}</aside>
    </div>`;
}
