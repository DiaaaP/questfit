"use client";

import { useState, type FormEvent } from "react";
import { Bell, Swords, Target, UserRound } from "lucide-react";
import type { ArenaEvent } from "@/shared/catalog";
import type { DashboardData, ProfilePreferences } from "@/shared/questfit";
import { Action, Back, eventDateLabel, Field, FormError, Go, Meter, navigate, type Athlete } from "./portal-ui";

export type ProfileUpdate = Partial<ProfilePreferences> & Partial<Pick<Athlete, "fullName" | "goal">>;

export function Brand() {
  return <span className="portal-brand"><span><Swords size={22} aria-hidden="true" /></span><strong>Quest<i>Fit</i></strong></span>;
}

export function AuthScreen({ mode, staticMode, ready, next, onAuth }: {
  mode: "login" | "register"; staticMode: boolean; ready: boolean; next: string;
  onAuth: (mode: "login" | "register", data: FormData) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setError("");
    try { await onAuth(mode, data); navigate(next); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось продолжить."); }
    finally { setPending(false); }
  }
  return <main className="portal-auth">
    <section className="portal-auth-photo"><a href="#overview" aria-label="QuestFit, главная"><Brand /></a>
      <div><h2>Движение<br />начинается здесь.</h2><p>Тренировки, квесты и команда в одном месте.</p></div>
    </section>
    <section className="portal-auth-body">
      <Back to="overview">На главную</Back>
      <h1>{mode === "register" ? "Создайте аккаунт" : "Вход в QuestFit"}</h1>
      <p>{mode === "register" ? "Начните сохранять свои результаты." : "Продолжите с того места, где остановились."}</p>
      {staticMode && <p className="portal-demo-note">Браузерное демо. Для него используйте отдельный пароль.</p>}
      <form className="portal-form" onSubmit={submit}>
        {mode === "register" && <Field label="Имя"><input name="fullName" minLength={2} maxLength={60} autoComplete="name" placeholder="Как к вам обращаться" required /></Field>}
        <Field label="Электронная почта"><input name="email" type="email" maxLength={160} autoComplete="email" placeholder="name@example.com" required /></Field>
        <Field label="Пароль" hint={mode === "register" ? "Минимум 8 символов" : undefined}><input name="password" type={showPassword ? "text" : "password"} minLength={mode === "register" ? 8 : undefined} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} required /></Field>
        <label className="portal-check"><input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Показать пароль</label>
        <FormError error={error} /><Action primary type="submit" disabled={!ready || pending}>{pending ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : "Войти"}</Action>
      </form>
      <div className="portal-auth-switch">{mode === "register" ? "Уже есть аккаунт?" : "Впервые в QuestFit?"} <a href={`#${mode === "register" ? "login" : "register"}?next=${encodeURIComponent(next)}`}>{mode === "register" ? "Войти" : "Зарегистрироваться"}</a></div>
    </section>
  </main>;
}

export function ProfileView({ view, user, dashboard, week, reminders, onSave, onLogout }: {
  view: string; user: Athlete; dashboard: DashboardData; week: number; reminders: ArenaEvent[];
  onSave: (update: ProfileUpdate) => Promise<void>; onLogout: () => Promise<void>;
}) {
  const [goal, setGoal] = useState(String(dashboard.preferences.weeklyGoalMinutes));
  const [enabled, setEnabled] = useState(dashboard.preferences.notificationsEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const update = view === "goal" ? { weeklyGoalMinutes: Number(goal) }
      : view === "notifications" ? { notificationsEnabled: enabled }
      : { fullName: String(values.get("fullName")).trim(), city: String(values.get("city")).trim(), goal: String(values.get("goal")).trim() };
    setPending(true); setError("");
    try { await onSave(update); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить изменения."); }
    finally { setPending(false); }
  }
  return <>
    {view !== "profile" && <Back to={view === "goal" ? "progress" : "profile"}>{view === "goal" ? "Прогресс" : "Профиль"}</Back>}
    <div className="portal-columns">
      <form className="portal-panel portal-form" onSubmit={submit}>
        <h2>{view === "goal" ? "План на неделю" : view === "notifications" ? "Показ уведомлений" : "Личные данные"}</h2>
        {view === "goal" ? <>
          <div className="portal-segments">{[90, 120, 150, 180].map((value) => <button type="button" aria-pressed={String(value) === goal} key={value} onClick={() => setGoal(String(value))}>{value} мин</button>)}</div>
          <Field label="Минуты в неделю"><input value={goal} onChange={(e) => setGoal(e.target.value)} type="number" min={60} max={2000} required /></Field>
        </> : view === "notifications" ? <label className="portal-switch">
          <span><strong>Напоминания о стартах</strong><small>События, на которые вы записались, появятся здесь и будут отмечены в меню.</small></span>
          <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label> : <>
          <Field label="Имя"><input name="fullName" defaultValue={user.fullName} minLength={2} maxLength={60} required /></Field>
          <Field label="Город"><input name="city" defaultValue={dashboard.preferences.city} minLength={2} maxLength={80} required /></Field>
          <Field label="Фитнес-цель"><input name="goal" defaultValue={user.goal} minLength={2} maxLength={80} required /></Field>
        </>}
        <FormError error={error} /><Action primary type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить изменения"}</Action>
      </form>
      <aside className="portal-panel portal-side-info">
        {view === "goal" ? <><Target size={24} aria-hidden="true" /><h2>Текущая неделя</h2><p>{week} из {dashboard.preferences.weeklyGoalMinutes} минут</p><Meter value={week / dashboard.preferences.weeklyGoalMinutes * 100} label="Выполнение недельной цели" /></>
          : view === "notifications" ? <><Bell size={24} aria-hidden="true" /><h2>Ближайшие старты</h2>
            {dashboard.preferences.notificationsEnabled && reminders.length ? <div className="portal-rows">{reminders.map((event) => <a className="portal-row" key={event.slug} href={`#event/${event.slug}`}><span><strong>{event.title}</strong><small>{eventDateLabel(event.startAt)}</small></span></a>)}</div>
              : <p>{dashboard.preferences.notificationsEnabled ? "Нет предстоящих стартов, на которые вы записаны." : "Напоминания отключены."}</p>}</>
            : <><UserRound size={25} aria-hidden="true" /><h2>{user.fullName}</h2><p>{user.email}</p><div className="portal-actions"><Go to="goal">Недельная цель</Go><Go to="notifications">Уведомления</Go><Action className="is-danger" onClick={() => void onLogout()}>Выйти</Action></div></>}
      </aside>
    </div>
  </>;
}
