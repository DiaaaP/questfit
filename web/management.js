import { back, button, dateTimeInput, empty, error, eventDate, field, go, html, icon, meter, num, rows, stat, submit } from "./ui.js";

export function teamView(view, { team, user, demo }, confirmation) {
  if (view === "create" || view === "join") {
    const create = view === "create";
    if (team) return empty(team.name, "Вы уже в команде. Чтобы вступить в другую, сначала покиньте текущую.", go("team/roster", "Открыть состав"));
    return html`${back("team", "Команда")}<div class="portal-columns">
      <form class="portal-panel portal-form" data-form="team-${view}">
        <h2>${create ? "Новая команда" : "Приглашение"}</h2>
        ${create ? html`
          ${field("Название команды", html`<input name="name" minlength="2" maxlength="60" placeholder="Например, Алатау" required>`)}
          ${field("Цель рейда, км", html`<input type="number" name="goalKm" min="10" max="10000" value="100" required>`)}
        ` : field("Код команды", html`<input name="code" minlength="4" maxlength="12" placeholder="Введите код" required>`, demo ? "Демонстрационный код URAL25" : "Код можно получить у любого участника команды.")}
        ${error}${submit(create ? "Создать команду" : "Вступить в команду")}
      </form>
      <aside class="portal-panel portal-side-info">${icon("Users", 25)}<h2>${create ? "Вы будете лидером" : "Тренируйтесь вместе"}</h2>
        <p>${create ? "После создания можно скопировать приглашение, собрать состав и начать рейд." : "Каждый участник может вносить километры в общую цель команды."}</p>
      </aside>
    </div>`;
  }
  if (!team) return html`<section class="portal-spotlight"><div class="portal-spotlight-copy">
    <span class="portal-chip">${icon("Users", 16)} Командные рейды</span>
    <h2>Соберите свою команду</h2><p>Складывайте километры с участниками и приближайтесь к общей цели.</p>
    <div class="portal-actions">${go("team/create", "Создать команду", true)}${go("team/join", "Вступить по коду")}</div>
  </div></section>`;

  const ratio = team.totalKm / team.goalKm * 100;
  if (view === "contribute") return html`${back("team", "Командный рейд")}<div class="portal-columns">
    <form class="portal-panel portal-form" data-form="team-contribute">
      <h2>Вклад в рейд</h2>
      ${field("Дистанция, км", html`<input name="distanceKm" type="number" step=".1" min=".1" max="300" placeholder="0,0" required>`, "Укажите расстояние, которое вы уже преодолели.")}
      ${error}${submit("Подтвердить вклад")}
    </form>
    <aside class="portal-panel portal-side-info">${icon("Target", 23)}<h2>${team.name}</h2>
      <p id="team-preview">${teamPreview(team, 0)}</p><div id="team-preview-meter">${meter(ratio, "Ожидаемый результат")}</div>
    </aside>
  </div>`;

  if (view === "roster") return html`${back("team", "К рейду")}
    <section class="portal-panel"><div class="portal-section-head"><h2>${team.name}</h2>
      ${button("copy-code", html`${icon("Copy", 16)} ${team.code}`)}
    </div>
    ${rows(team.members.map(member => html`<div class="portal-row portal-member">
      <span class="portal-icon">${member.name.slice(0, 2).toUpperCase()}</span>
      <span><strong>${member.name}${member.userId === user.id ? " · вы" : ""}</strong><small>${num(member.contributionKm)} км · ${member.xp} XP</small></span>
      ${member.role === "leader" ? html`<span class="portal-chip">${icon("ShieldCheck", 15)} Лидер</span>`
        : team.leaderId === user.id ? html`<div class="portal-actions">
        ${button("ask-transfer", "Передать роль", { value: member.userId })}
        ${button("ask-kick", "Исключить", { value: member.userId, danger: true })}
        </div>` : html`<span class="portal-muted">Участник</span>`}
    </div>`))}
    <div class="portal-actions">${button("ask-leave", "Покинуть команду", { danger: true })}</div>
    ${confirmation && html`<div class="portal-confirm"><p>${confirmation.description}</p><div class="portal-actions">
      ${button("confirm-team", "Подтвердить", { primary: true })}${button("dismiss", "Отмена")}
    </div></div>`}${error}
  </section>`;

  const contribution = team.members.find(member => member.userId === user.id)?.contributionKm ?? 0;
  return html`<section class="portal-spotlight"><div class="portal-spotlight-copy">
      <span class="portal-chip">${icon("Target", 16)} Командный рейд</span><h2>${team.name}</h2>
      <p>${num(team.totalKm)} из ${num(team.goalKm)} км · ${ratio >= 100 ? "Цель достигнута" : "осталось " + num(team.goalKm - team.totalKm) + " км"}</p>
      ${meter(ratio, "Общая цель рейда")}
      <div class="portal-actions">
        ${go("team/contribute", "Добавить вклад", true)}
        ${go("team/roster", "Состав команды")}
      </div>
    </div></section>
    <div class="portal-stat-grid">${stat("Личный вклад", num(contribution) + " км")}${stat("Состав", team.members.length)}${stat("Выполнение цели", Math.round(ratio) + "%")}</div>`;
}

export function teamPreview(team, distance) {
  return num(team.totalKm) + " → " + num(team.totalKm + distance) + " км из " + num(team.goalKm) + " км";
}

export function adminView(view, { admin, demo, now }, selected) {
  if (!admin) return empty("Загружаем админ-панель", "Получаем каталог и список пользователей.");
  if (view !== "quests" && view !== "events") return html`
    <div class="portal-stat-grid">${stat("Пользователи", admin.users.length)}${stat("Квесты в редакторе", admin.quests.length)}${stat("Соревнования в редакторе", admin.events.length)}</div>
    <div class="portal-columns is-balanced">
      <section class="portal-panel portal-side-info">${icon("Zap", 24)}<h2>Квесты</h2><p>Публикуйте задания и управляйте наградами.</p>${go("admin/quests", "Редактор квестов", true)}</section>
      <section class="portal-panel portal-side-info">${icon("CalendarDays", 24)}<h2>Соревнования</h2><p>Меняйте расписание и доступность записи на старты.</p>${go("admin/events", "Редактор соревнований", true)}</section>
    </div>
    <section class="portal-panel"><div class="portal-section-head"><h2>Пользователи</h2><span class="portal-chip">${icon("ShieldCheck", 16)} ${demo ? "Демо" : "Владелец"}</span></div>
      ${rows(admin.users.map(item => html`<div class="portal-row"><span class="portal-icon">${icon("Users", 18)}</span>
        <span><strong>${item.fullName}</strong><small>${item.email} · ${item.teamName || "Без команды"}</small></span>
        ${!demo && html`<span class="portal-row-end">${item.workoutCount} тренировок</span>`}
      </div>`))}
    </section>`;

  const isQuest = view === "quests";
  const entries = isQuest ? admin.quests : admin.events;
  const item = entries.find(entry => entry.id === selected);
  return html`${back("admin", "Администрирование")}<div class="portal-columns is-admin">
    <aside class="portal-panel"><div class="portal-section-head"><h2>${isQuest ? "Квесты" : "Соревнования"}</h2>${button("admin-new", "Новый")}</div>
      ${rows(entries.map(entry => {
        const summary = html`<span class="portal-icon">${icon(isQuest ? "Zap" : "CalendarDays", 18)}</span>
          <span><strong>${entry.title}</strong><small>${isQuest ? entry.detail : eventDate(entry.startAt)}</small></span>
          <small class="portal-row-end">${entry.active ? "Активно" : "Черновик"}</small>`;
        return selected === entry.id
          ? html`<div class="portal-row is-me" aria-current="true">${summary}</div>`
          : html`<button type="button" class="portal-row" data-action="admin-select" data-value="${entry.id}">${summary}</button>`;
      }))}
      ${!entries.length && html`<p class="portal-muted">Создайте первую запись.</p>`}
    </aside>
    <section class="portal-panel">
      <form class="portal-form" data-form="admin" ${item && "data-requires-change"}>
        <h2>${item ? "Редактирование" : isQuest ? "Новый квест" : "Новое соревнование"}</h2>
        ${field("Название", html`<input name="title" minlength="2" maxlength="${isQuest ? 80 : 100}" value="${item?.title ?? ""}" required>`)}
        ${isQuest ? html`
          ${field("Условие", html`<textarea name="detail" rows="3" minlength="2" maxlength="160" required>${item?.detail ?? ""}</textarea>`)}
          ${field("Награда XP", html`<input name="xp" type="number" min="10" max="10000" value="${item?.xp ?? 80}" required>`)}
        ` : html`
          ${field("Место старта", html`<input name="location" minlength="2" maxlength="120" value="${item?.location ?? ""}" required>`)}
          <div class="portal-form-pair">
            ${field("Дата и время", html`<input name="startAt" type="datetime-local" value="${dateTimeInput(item?.startAt ?? now + 604800000)}" required>`)}
            ${field("Дистанция, км", html`<input name="distanceKm" type="number" min=".1" max="1000" step=".1" value="${item?.distanceKm ?? 5}" required>`)}
          </div>
          <div class="portal-form-pair">
            ${field("Свободные и занятые места, всего", html`<input name="capacity" type="number" min="${Math.max(1, item?.registrations ?? 0)}" max="100000" value="${item?.capacity ?? 100}" required>`)}
            ${field("Награда XP", html`<input name="rewardXp" type="number" min="10" max="100000" value="${item?.rewardXp ?? 150}" required>`)}
          </div>
        `}
        <label class="portal-check"><input name="active" type="checkbox" ${(item?.active ?? true) && "checked"}> Показывать пользователям</label>
        <div class="portal-actions">${submit("Сохранить", Boolean(item))}${item && button("ask-admin-delete", "Удалить", { danger: true })}</div>
        ${item && html`<div class="portal-confirm" data-admin-delete hidden><p>${isQuest ? "Удалить этот квест?" : "Удалить событие и отменить действующие записи?"}</p>
          <div class="portal-actions">${button("admin-delete", "Подтвердить удаление", { danger: true })}${button("dismiss-admin-delete", "Отмена")}</div>
        </div>`}${error}
      </form>
    </section>
  </div>`;
}
