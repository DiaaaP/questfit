"use client";

import { useState, type FormEvent } from "react";
import { Activity, CalendarDays, Check, Dumbbell, Footprints, MapPin, Route, Swords, Target, Users, Zap } from "lucide-react";
import type { ArenaEvent, Quest } from "@/shared/catalog";
import { Action, Back, Empty, eventDateLabel, FormError, formatNumber as num, Go, Meter, navigate, Stat, type Athlete } from "./portal-ui";

const categories = {
  strength: { name: "Силовая", icon: Dumbbell },
  run: { name: "Бег", icon: Activity },
  walk: { name: "Ходьба", icon: Footprints },
  team: { name: "Команда", icon: Users },
  custom: { name: "Задание", icon: Target },
};

export function QuestRows({ quests, completed }: { quests: Quest[]; completed: number[] }) {
  return <div className="portal-rows">{quests.map((quest) => {
    const { name, icon: Icon } = categories[quest.category];
    const done = completed.includes(quest.id);
    return <a href={`#quest/${quest.id}`} key={quest.id} className="portal-row">
      <span className={`portal-icon activity-${quest.category}`}><Icon size={20} aria-hidden="true" /></span>
      <span><strong>{quest.title}</strong><small>{name} · {quest.detail}</small></span>
      <span className={`portal-row-end ${done ? "portal-success" : "portal-ember"}`}>{done && <Check size={15} aria-label="Выполнен" />} +{quest.xp} XP</span>
    </a>;
  })}</div>;
}

export function QuestCatalog({ quests, completed }: { quests: Quest[]; completed: number[] }) {
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const shown = quests.filter(({ id }) => filter === "all" || completed.includes(id) === (filter === "done"));
  const count = quests.filter(({ id }) => completed.includes(id)).length;
  return <>
    <div className="portal-stat-grid"><Stat label="Выполнено" value={`${count} / ${quests.length}`} /><Stat label="Получено за квесты" value={`${quests.filter(({id}) => completed.includes(id)).reduce((sum, quest) => sum + quest.xp, 0)} XP`} /></div>
    <section className="portal-panel"><div className="portal-section-head"><h2>Доступные задания</h2><div className="portal-segments">
      {([["all", "Все"], ["active", "Активные"], ["done", "Выполненные"]] as const).map(([key, label]) =>
        <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div></div>
      {shown.length ? <QuestRows quests={shown} completed={completed} /> : <p className="portal-muted">В этой категории пока нет квестов.</p>}
    </section>
  </>;
}

export function QuestDetail({ quest, done, pending, onToggle }: { quest?: Quest; done: boolean; pending: boolean; onToggle: () => void }) {
  if (!quest) return <Empty title="Квест недоступен" text="Выберите другое задание из списка."><Go to="quests">К квестам</Go></Empty>;
  const Icon = categories[quest.category].icon;
  return <>
    <Back to="quests">Все квесты</Back>
    <section className={`portal-spotlight ${quest.category === "run" ? "has-photo" : ""}`}>
      <div className="portal-spotlight-copy">
        <span className="portal-chip"><Icon size={16} aria-hidden="true" /> {categories[quest.category].name}</span>
        <h2>{quest.title}</h2><p>{quest.detail}</p>
        <div className="portal-actions"><Action primary onClick={onToggle} disabled={pending}>{pending ? "Сохранение…" : done ? "Снять отметку" : "Отметить выполненным"}</Action>
          {quest.category !== "custom" && <Go to={quest.category === "team" ? "team/raid" : `workout/new/${quest.category}`}>{quest.category === "team" ? "К рейду" : "Записать тренировку"}</Go>}</div>
      </div>
    </section>
    <div className="portal-stat-grid"><Stat label="Награда" value={`+${quest.xp} XP`} /><Stat label="Статус" value={done ? "Выполнен" : "Активен"} /></div>
  </>;
}

export function ArenaCatalog({ events, joined }: { events: ArenaEvent[]; joined: string[] }) {
  const [filter, setFilter] = useState("all");
  const visible = events.filter((event) => filter !== "mine" || joined.includes(event.slug));
  const featured = events.find((event) => event.startAt > Date.now()) ?? events[0];
  return <>
    {featured && <section className="portal-spotlight has-photo">
      <div className="portal-spotlight-copy"><span className="portal-chip"><CalendarDays size={16} aria-hidden="true" /> Ближайшие старты</span>
        <h2>{featured.title}</h2><p>{eventDateLabel(featured.startAt)} · {num(featured.distanceKm)} км · {featured.location}</p>
        <Go to={`event/${featured.slug}`} primary>Подробнее о старте</Go></div>
    </section>}
    <section className="portal-panel"><div className="portal-section-head"><h2>Календарь арены</h2><div className="portal-segments">
      <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Все события</button>
      <button type="button" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>Мои записи</button>
    </div></div>
      <div className="portal-rows">{visible.map((event) => <a className="portal-row" href={`#event/${event.slug}`} key={event.slug}>
        <span className="portal-icon activity-run"><CalendarDays size={20} aria-hidden="true" /></span>
        <span><strong>{event.title}</strong><small>{eventDateLabel(event.startAt)} · {event.location} · {num(event.distanceKm)} км</small></span>
        <span className="portal-row-end">{joined.includes(event.slug) ? "Вы записаны" : event.startAt > Date.now() ? "Предстоит" : "Завершено"}</span>
      </a>)}</div>
      {!visible.length && <p className="portal-muted">{filter === "mine" ? "У вас пока нет записей на старты." : "Новые старты появятся здесь."}</p>}
    </section>
  </>;
}

export function EventDetail({ event, joined, onRegister }: { event?: ArenaEvent; joined: boolean; onRegister: (value: boolean) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!event) return <Empty title="Событие недоступно" text="Вернитесь в календарь, чтобы найти другой старт."><Go to="arena">Календарь</Go></Empty>;
  const available = event.startAt > Date.now() && event.registrations < event.capacity;
  return <>
    <Back to="arena">Календарь арены</Back>
    <section className="portal-spotlight has-photo">
      <div className="portal-spotlight-copy"><span className="portal-chip"><MapPin size={16} aria-hidden="true" /> {event.location}</span>
        <h2>{event.title}</h2><p>{eventDateLabel(event.startAt)} · время Алматы</p>
        {joined ? <div className="portal-actions"><span className="portal-chip portal-success"><Check size={17} aria-hidden="true" /> Вы записаны</span>
          <Action disabled={pending} onClick={async () => {
            setPending(true); setError("");
            try { await onRegister(false); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отменить запись."); }
            finally { setPending(false); }
          }}>Отменить запись</Action></div> : available ? <Go to={`event/${event.slug}/join`} primary>Записаться на старт</Go> : <span className="portal-chip">Запись закрыта</span>}
        <FormError error={error} />
      </div>
    </section>
    <div className="portal-stat-grid"><Stat label="Дистанция" value={`${num(event.distanceKm)} км`} /><Stat label="Места" value={`${event.registrations} / ${event.capacity}`} /><Stat label="Награда за финиш" value={`+${event.rewardXp} XP`} /></div>
    <section className="portal-panel portal-side-info"><Route size={23} aria-hidden="true" /><h2>Старт и маршрут</h2>
      <p>{event.location} · {num(event.distanceKm)} км</p><Meter value={event.registrations / event.capacity * 100} label="Заполненность старта" />
    </section>
  </>;
}

export function EventSignup({ event, user, onRegister }: { event?: ArenaEvent; user: Athlete; onRegister: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!event) return <Empty title="Событие недоступно" text="Проверьте актуальные старты в календаре."><Go to="arena">Календарь</Go></Empty>;
  const slug = event.slug;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true); setError("");
    try { await onRegister(); navigate(`event/${slug}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось записаться."); }
    finally { setPending(false); }
  }
  return <>
    <Back to={`event/${slug}`}>Детали события</Back>
    <div className="portal-columns">
      <form className="portal-panel portal-form" onSubmit={submit}><h2>Участник</h2>
        <div className="portal-summary-row"><span>Имя</span><strong>{user.fullName}</strong></div>
        <div className="portal-summary-row"><span>Почта</span><strong>{user.email}</strong></div>
        <label className="portal-check"><input type="checkbox" required /> Я проверил дату и место старта и подтверждаю участие.</label>
        <FormError error={error} /><Action primary type="submit" disabled={pending}>{pending ? "Подтверждение…" : "Подтвердить участие"}</Action>
      </form>
      <aside className="portal-panel portal-side-info"><CalendarDays size={24} aria-hidden="true" /><h2>{event.title}</h2>
        <p>{eventDateLabel(event.startAt)} · {event.location}</p><span className="portal-chip"><Swords size={15} aria-hidden="true" /> {num(event.distanceKm)} км</span>
        <span className="portal-xp"><Zap size={15} aria-hidden="true" /> {event.rewardXp} XP за финиш</span></aside>
    </div>
  </>;
}
