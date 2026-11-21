"use client";

import { useState, type FormEvent } from "react";
import { Activity, Bike, Dumbbell, Footprints, Medal, Timer, TrendingUp, Zap } from "lucide-react";
import { calculateWorkoutXp, workoutTypeLabels, type DashboardData, type NewWorkoutInput, type WorkoutEntry, type WorkoutType } from "@/shared/questfit";
import { Action, Back, dateLabel, Empty, Field, FormError, formatNumber as num, Go, Meter, navigate, Stat } from "./portal-ui";

const activityIcons = { run: Activity, strength: Dumbbell, walk: Footprints, cycling: Bike, mobility: Timer };
const activityHints: Record<WorkoutType, string> = {
  run: "Темп, дистанция и выносливость", walk: "Спокойная или быстрая прогулка",
  cycling: "Велосипед, велотренажёр или трейл", strength: "Зал, силовые и упражнения с весом",
  mobility: "Растяжка, восстановление и работа с подвижностью",
};
const types = Object.keys(workoutTypeLabels) as WorkoutType[];

function calendarDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function weeklyMinutes(workouts: WorkoutEntry[], now = new Date()) {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return workouts.reduce((total, workout) =>
    workout.performedAt >= monday.getTime() && workout.performedAt <= now.getTime() ? total + workout.durationMinutes : total, 0);
}

function ActivityMark({ type }: { type: WorkoutType }) {
  const Icon = activityIcons[type];
  return <span className={`portal-icon activity-${type}`}><Icon size={20} aria-hidden="true" /></span>;
}

export function WorkoutList({ workouts }: { workouts: WorkoutEntry[] }) {
  return <div className="portal-rows">
    {workouts.map((workout) => <a className="portal-row" key={workout.id} href={`#workout/${workout.id}`}>
      <ActivityMark type={workout.type} />
      <span><strong>{workout.title}</strong><small>{dateLabel(workout.performedAt)} · {workoutTypeLabels[workout.type]}</small></span>
      <span className="portal-row-end"><strong>{workout.durationMinutes} мин</strong><small>{workout.distanceKm ? `${num(workout.distanceKm)} км · ` : ""}+{workout.xp} XP</small></span>
    </a>)}
  </div>;
}

export function WorkoutJournal({ workouts }: { workouts: WorkoutEntry[] }) {
  const [type, setType] = useState<"all" | WorkoutType>("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("all");
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(end.getDate() - (Number(period) - 1));
  const shown = workouts.filter((workout) =>
    (type === "all" || workout.type === type) &&
    (period === "all" || workout.performedAt >= start.getTime()) &&
    workout.title.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")));
  return <>
    <div className="portal-stat-grid">
      <Stat label="За неделю" value={`${weeklyMinutes(workouts, end)} мин`} detail="С понедельника" />
      <Stat label="Тренировки в журнале" value={workouts.length} />
      <Stat label="Дистанция в журнале" value={`${num(workouts.reduce((sum, item) => sum + item.distanceKm, 0))} км`} />
    </div>
    <section className="portal-panel">
      <div className="portal-section-head"><h2>История тренировок</h2><Go to="workout/new" primary>Добавить тренировку</Go></div>
      <div className="portal-filters">
        <input aria-label="Поиск тренировок" type="search" placeholder="Найти по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Вид активности" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Все активности</option>{types.map((item) => <option key={item} value={item}>{workoutTypeLabels[item]}</option>)}
        </select>
        <select aria-label="Период" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="all">Всё время</option><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option>
        </select>
      </div>
      {shown.length ? <WorkoutList workouts={shown} /> : <p className="portal-muted">{workouts.length ? "По этим фильтрам ничего не найдено." : "Здесь появится первая записанная тренировка."}</p>}
    </section>
  </>;
}

export function ActivityChoice() {
  return <>
    <Back to="workouts">Журнал тренировок</Back>
    <div className="portal-step"><span className="is-current">Вид активности</span><span>Показатели</span></div>
    <div className="portal-choice-grid">{types.map((type) =>
      <a className="portal-panel portal-choice" key={type} href={`#workout/new/${type}`}>
        <ActivityMark type={type} /><strong>{workoutTypeLabels[type]}</strong><small>{activityHints[type]}</small>
      </a>)}</div>
  </>;
}

export function WorkoutForm({ type, onSave }: { type: WorkoutType; onSave: (input: NewWorkoutInput) => Promise<WorkoutEntry> }) {
  const [duration, setDuration] = useState("30");
  const [distance, setDistance] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const today = calendarDate(new Date());
    const date = String(data.get("date"));
    try {
      const performedAt = date === today ? Date.now() : Date.parse(`${date}T12:00:00`);
      if (!Number.isFinite(performedAt) || date > today) throw new Error("Укажите дату в прошлом или сегодня.");
      const workout = await onSave({
        type, performedAt, durationMinutes: Number(duration), distanceKm: Number(distance),
        calories: Number(data.get("calories")), title: String(data.get("title")).trim(), notes: String(data.get("notes")).trim(),
      });
      navigate(`workout/${workout.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить тренировку.");
    } finally {
      setPending(false);
    }
  }
  return <>
    <Back to="workout/new">Вид активности</Back>
    <div className="portal-step"><span>{workoutTypeLabels[type]}</span><span className="is-current">Показатели</span></div>
    <div className="portal-columns">
      <form className="portal-panel portal-form" onSubmit={save}>
        <Field label="Название"><input name="title" placeholder="Например, лёгкая пробежка" required minLength={2} maxLength={80} /></Field>
        <Field label="Дата"><input name="date" type="date" defaultValue={calendarDate(new Date())} max={calendarDate(new Date())} required /></Field>
        <div className="portal-form-pair">
          <Field label="Длительность, мин"><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={5} max={600} required /></Field>
          <Field label="Дистанция, км"><input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} min={0} max={300} step=".01" placeholder="0" /></Field>
        </div>
        <Field label="Энергозатраты, ккал"><input name="calories" type="number" min={0} max={10000} placeholder="Необязательно" /></Field>
        <Field label="Заметка"><textarea name="notes" rows={3} maxLength={300} placeholder="Как прошла тренировка?" /></Field>
        <FormError error={error} />
        <Action primary type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить тренировку"}</Action>
      </form>
      <aside className="portal-panel portal-side-info"><ActivityMark type={type} /><h2>{workoutTypeLabels[type]}</h2>
        <p>Запись попадёт в журнал и обновит вашу недельную цель.</p>
        <div className="portal-xp"><Zap size={17} aria-hidden="true" /> +{calculateWorkoutXp({ durationMinutes: Number(duration), distanceKm: Number(distance) }) || 0} XP</div>
      </aside>
    </div>
  </>;
}

export function WorkoutDetails({ workout, onDelete, editable }: { workout?: WorkoutEntry; onDelete: (id: number) => Promise<void>; editable: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!workout) return <Empty title="Тренировка не найдена" text="Откройте другую запись в журнале."><Go to="workouts">К журналу</Go></Empty>;
  const pace = workout.distanceKm > 0 ? Math.round(workout.durationMinutes * 60 / workout.distanceKm) : 0;
  async function remove() {
    if (!workout) return;
    setPending(true);
    setError("");
    try { await onDelete(workout.id); navigate("workouts"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось удалить тренировку."); }
    finally { setPending(false); }
  }
  return <>
    <Back to="workouts">Журнал тренировок</Back>
    <div className="portal-stat-grid">
      <Stat label="Длительность" value={`${workout.durationMinutes} мин`} />
      <Stat label="Дистанция" value={`${num(workout.distanceKm)} км`} detail={pace > 0 ? `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")} мин/км` : undefined} />
      <Stat label="Опыт" value={`+${workout.xp} XP`} detail={`${workout.calories} ккал`} />
    </div>
    <section className="portal-panel portal-side-info"><ActivityMark type={workout.type} /><h2>{workout.title}</h2>
      <p>{dateLabel(workout.performedAt)} · {workoutTypeLabels[workout.type]}</p>
      {workout.notes && <p className="portal-note">{workout.notes}</p>}
      <div className="portal-actions"><Go to="progress" primary>Смотреть прогресс</Go>
        {editable && !confirm && <Action className="is-danger" onClick={() => setConfirm(true)}>Удалить запись</Action>}
      </div>
      {confirm && <div className="portal-confirm"><p>Удалить тренировку из журнала и пересчитать XP?</p><div className="portal-actions">
        <Action className="is-danger" onClick={() => void remove()} disabled={pending}>Удалить</Action>
        <Action onClick={() => setConfirm(false)} disabled={pending}>Отмена</Action></div></div>}
      <FormError error={error} />
    </section>
  </>;
}

export function ProgressSection({ dashboard }: { dashboard: DashboardData }) {
  const [period, setPeriod] = useState(7);
  const today = new Date();
  const days = Array.from({ length: period }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - period + index + 1);
    const key = calendarDate(date);
    const total = dashboard.workouts.filter((item) => calendarDate(new Date(item.performedAt)) === key)
      .reduce((minutes, item) => minutes + item.durationMinutes, 0);
    return { key, label: period === 7 ? date.toLocaleDateString("ru-RU", { weekday: "short" }) : String(date.getDate()), total };
  });
  const peak = Math.max(1, ...days.map((day) => day.total));
  const week = weeklyMinutes(dashboard.workouts);
  const goal = dashboard.preferences.weeklyGoalMinutes;
  return <>
    <div className="portal-stat-grid">
      <Stat label="Текущая неделя" value={`${week} / ${goal} мин`} detail={week >= goal ? "Цель достигнута" : `До цели ${goal - week} мин`} />
      <Stat label={`За ${period} дней`} value={`${days.reduce((sum, day) => sum + day.total, 0)} мин`} />
      <Stat label="XP за тренировки" value={num(dashboard.totals.workoutXp)} />
    </div>
    <section className="portal-panel">
      <div className="portal-section-head"><h2>Время в движении</h2><div className="portal-segments">
        {[7, 30].map((value) => <button type="button" key={value} aria-pressed={value === period} onClick={() => setPeriod(value)}>{value} дней</button>)}
      </div></div>
      <div className="portal-chart" aria-label="Минуты активности по дням">
        {days.map(({ key, label, total }, index) => <div key={key} className="portal-bar" aria-label={`${key}: ${total} мин`} title={`${key}: ${total} мин`}>
          <div><span className={index === days.length - 1 ? "current" : ""} style={{ height: `${total / peak * 100}%` }} /></div>
          <small>{period === 7 || index % 5 === 0 || index === days.length - 1 ? label : " "}</small>
        </div>)}
      </div>
    </section>
    <div className="portal-columns is-balanced">
      <section className="portal-panel portal-side-info"><TrendingUp size={22} /><h2>Недельная цель</h2><Meter value={week / goal * 100} label="Выполнение недельной цели" /><Go to="goal">Изменить цель</Go></section>
      <section className="portal-panel portal-side-info"><Medal size={22} /><h2>Результаты</h2><div className="portal-actions"><Go to="achievements">Достижения</Go><Go to="leaderboard">Рейтинг</Go></div></section>
    </div>
  </>;
}

export function Achievements({ dashboard }: { dashboard: DashboardData }) {
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  const earned = dashboard.achievements.filter((item) => item.unlocked).length;
  return <section className="portal-panel">
    <div className="portal-section-head"><h2>Награды {earned} / {dashboard.achievements.length}</h2><Action aria-pressed={onlyUnlocked} onClick={() => setOnlyUnlocked(!onlyUnlocked)}>{onlyUnlocked ? "Показать все" : "Только полученные"}</Action></div>
    <div className="portal-choice-grid">
      {dashboard.achievements.filter((item) => !onlyUnlocked || item.unlocked).map((item) => <article className="portal-choice portal-tile" key={item.slug}>
        <span className={`portal-icon ${item.unlocked ? "activity-strength" : ""}`}><Medal size={23} aria-hidden="true" /></span>
        <strong>{item.title}</strong><small>{item.description}</small><Meter value={item.progress} label={item.title} />
        <small>{item.unlocked ? "Получено" : `${item.progress}% выполнено`}</small>
      </article>)}
    </div>
    {onlyUnlocked && !earned && <p className="portal-muted">Запишите тренировку, чтобы получить первую награду.</p>}
  </section>;
}

export function Leaderboard({ dashboard, demo }: { dashboard: DashboardData; demo: boolean }) {
  const entries = [...dashboard.leaderboard].sort((a, b) => b.xp - a.xp);
  return <section className="portal-panel">
    <div className="portal-section-head"><h2>Рейтинг · {dashboard.preferences.city}</h2>{demo && <span className="portal-chip">Демо</span>}</div>
    {!entries.length && <p className="portal-muted">Пока нет результатов для этого города.</p>}
    <div className="portal-rows">
      {entries.map((item, i) => <div key={item.position} className={`portal-row ${item.currentUser ? "is-me" : ""}`}>
        <span className="portal-rank">{i + 1}</span><span><strong>{item.name}</strong>{item.currentUser && <small>Ваш результат</small>}</span>
        <strong className="portal-row-end">{num(item.xp)} XP</strong>
      </div>)}
    </div>
  </section>;
}
