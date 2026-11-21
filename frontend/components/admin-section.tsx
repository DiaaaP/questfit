"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, ShieldCheck, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { starterEvents } from "@/shared/catalog";
import type { AdminData, AdminEvent, AdminQuest } from "@/shared/questfit";
import { Action, api, Back, Empty, eventDateLabel, Field, FormError, Go, readLocal, Stat, type Athlete } from "./portal-ui";

export const adminStorageKey = "qf_pages_admin";

function localAdmin(user: Athlete): AdminData {
  const saved = readLocal<AdminData | null>(adminStorageKey, null);
  return { quests: saved?.quests ?? [], events: saved?.events ?? starterEvents.map((event) => ({ ...event, id: 1 })),
    users: [{ ...user, createdAt: user.id, workoutCount: 0, teamName: null }] };
}

function inputDate(time: number) {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type AdminAction =
  | ({ action: "createQuest" | "updateQuest"; id?: number } & Omit<AdminQuest, "id">)
  | ({ action: "createEvent" | "updateEvent"; id?: number } & Omit<AdminEvent, "id" | "registrations">)
  | { action: "deleteQuest" | "deleteEvent"; id: number };

function applyLocal(data: AdminData, change: AdminAction): AdminData {
  const nextId = (items: { id: number }[]) => Math.max(0, ...items.map((item) => item.id)) + 1;
  switch (change.action) {
    case "createQuest": return { ...data, quests: [{ ...change, id: nextId(data.quests) }, ...data.quests] };
    case "updateQuest": return { ...data, quests: data.quests.map((item) => item.id === change.id ? { ...item, ...change, id: item.id } : item) };
    case "deleteQuest": return { ...data, quests: data.quests.filter((item) => item.id !== change.id) };
    case "createEvent": return { ...data, events: [{ ...change, id: nextId(data.events), registrations: 0 }, ...data.events] };
    case "updateEvent": return { ...data, events: data.events.map((item) => item.id === change.id ? { ...item, ...change, id: item.id } : item) };
    case "deleteEvent": return { ...data, events: data.events.filter((item) => item.id !== change.id) };
  }
}

export function AdminSection({ user, staticMode, view, onChange }: {
  user: Athlete | null; staticMode: boolean; view: string; onChange: () => void;
}) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const source = staticMode ? Promise.resolve(localAdmin(user)) : api<AdminData>("/api/admin");
    source.then((value) => active && setData(value))
      .catch((reason) => active && setLoadError(reason instanceof Error ? reason.message : "Нет доступа."));
    return () => { active = false; };
  }, [user, staticMode]);

  if (!user || (!staticMode && user.id !== 1)) return <Empty title="Доступ ограничен" text="Управление каталогом доступно владельцу QuestFit."><Go to="overview">На главную</Go></Empty>;
  if (loadError) return <Empty title="Не удалось открыть админ-панель" text={loadError}><Action onClick={() => window.location.reload()}>Повторить</Action></Empty>;
  if (!data) return <Empty title="Загружаем админ-панель" text="Получаем каталог и список пользователей." />;

  async function change(action: AdminAction) {
    if (!data) return;
    setError(""); setPending(true);
    try {
      const next = staticMode ? applyLocal(data, action) : await api<AdminData>("/api/admin", "POST", action);
      if (staticMode) localStorage.setItem(adminStorageKey, JSON.stringify(next));
      setData(next);
      if (action.action.startsWith("delete")) setSelected(null);
      setConfirmDelete(false);
      toast.success("Изменения сохранены");
      onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить изменения.");
    } finally { setPending(false); }
  }

  if (view !== "quests" && view !== "events") return <>
    <div className="portal-stat-grid">
      <Stat label="Пользователи" value={data.users.length} /><Stat label="Квесты в редакторе" value={data.quests.length} /><Stat label="Соревнования в редакторе" value={data.events.length} />
    </div>
    <div className="portal-columns is-balanced">
      <section className="portal-panel portal-side-info"><Zap size={24} aria-hidden="true" /><h2>Квесты</h2><p>Публикуйте задания и управляйте наградами.</p><Go to="admin/quests" primary>Редактор квестов</Go></section>
      <section className="portal-panel portal-side-info"><CalendarDays size={24} aria-hidden="true" /><h2>Соревнования</h2><p>Меняйте расписание и доступность записи на старты.</p><Go to="admin/events" primary>Редактор соревнований</Go></section>
    </div>
    <section className="portal-panel"><div className="portal-section-head"><h2>Пользователи</h2><span className="portal-chip"><ShieldCheck size={16} aria-hidden="true" /> {staticMode ? "Демо" : "Владелец"}</span></div>
      <div className="portal-rows">{data.users.map((item) => <div key={item.id} className="portal-row">
        <span className="portal-icon"><Users size={18} aria-hidden="true" /></span><span><strong>{item.fullName}</strong><small>{item.email} · {item.teamName || "Без команды"}</small></span>
        {!staticMode && <span className="portal-row-end">{item.workoutCount} тренировок</span>}
      </div>)}</div>
    </section>
  </>;

  const isQuest = view === "quests";
  const quest = isQuest ? data.quests.find((item) => item.id === selected) : undefined;
  const event = isQuest ? undefined : data.events.find((item) => item.id === selected);
  const item = quest ?? event;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title")).trim();
    const active = form.has("active");
    if (isQuest) {
      void change({ action: item ? "updateQuest" : "createQuest", id: item?.id, title, active,
        detail: String(form.get("detail")).trim(), xp: Number(form.get("xp")) });
    } else {
      void change({ action: item ? "updateEvent" : "createEvent", id: item?.id, title, active,
        slug: event?.slug ?? `event-${crypto.randomUUID().slice(0, 12)}`, location: String(form.get("location")).trim(),
        distanceKm: Number(form.get("distanceKm")), startAt: Date.parse(String(form.get("startAt"))),
        rewardXp: Number(form.get("rewardXp")), capacity: Number(form.get("capacity")) });
    }
  }
  return <>
    <Back to="admin">Администрирование</Back>
    <div className="portal-columns is-admin">
      <aside className="portal-panel">
        <div className="portal-section-head"><h2>Каталог</h2><Action disabled={pending} onClick={() => { setSelected(null); setConfirmDelete(false); setError(""); }}>Новый</Action></div>
        <div className="portal-rows">{(isQuest ? data.quests : data.events).map((entry) => <button
          type="button" key={entry.id} className={`portal-row ${selected === entry.id ? "is-me" : ""}`} disabled={pending}
          onClick={() => { setSelected(entry.id); setConfirmDelete(false); setError(""); }}>
          <span className="portal-icon">{isQuest ? <Zap size={18} aria-hidden="true" /> : <CalendarDays size={18} aria-hidden="true" />}</span>
          <span><strong>{entry.title}</strong><small>{"detail" in entry ? entry.detail : eventDateLabel(entry.startAt)}</small></span>
          <small className="portal-row-end">{entry.active ? "Активно" : "Черновик"}</small>
        </button>)}</div>
        {!(isQuest ? data.quests.length : data.events.length) && <p className="portal-muted">Создайте первую запись.</p>}
      </aside>
      <section className="portal-panel">
        <form className="portal-form" key={item?.id ?? "new"} onSubmit={submit}>
          <h2>{item ? "Редактирование" : isQuest ? "Новый квест" : "Новое соревнование"}</h2>
          <Field label="Название"><input name="title" minLength={2} maxLength={isQuest ? 80 : 100} defaultValue={item?.title} required /></Field>
          {isQuest ? <>
            <Field label="Условие"><textarea name="detail" rows={3} minLength={2} maxLength={160} defaultValue={quest?.detail} required /></Field>
            <Field label="Награда XP"><input name="xp" type="number" min={10} max={10000} defaultValue={quest?.xp ?? 80} required /></Field>
          </> : <>
            <Field label="Место старта"><input name="location" minLength={2} maxLength={120} defaultValue={event?.location} required /></Field>
            <div className="portal-form-pair">
              <Field label="Дата и время"><input name="startAt" type="datetime-local" defaultValue={inputDate(event?.startAt ?? Date.now() + 604800000)} required /></Field>
              <Field label="Дистанция, км"><input name="distanceKm" type="number" min=".1" max={1000} step=".1" defaultValue={event?.distanceKm ?? 5} required /></Field>
            </div>
            <div className="portal-form-pair">
              <Field label="Свободные и занятые места, всего"><input name="capacity" type="number" min={Math.max(1, event?.registrations ?? 0)} max={100000} defaultValue={event?.capacity ?? 100} required /></Field>
              <Field label="Награда XP"><input name="rewardXp" type="number" min={10} max={100000} defaultValue={event?.rewardXp ?? 150} required /></Field>
            </div>
          </>}
          <label className="portal-check"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Показывать пользователям</label>
          <div className="portal-actions"><Action primary type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</Action>
            {item && <Action className="is-danger" disabled={pending} onClick={() => setConfirmDelete(true)}>Удалить</Action>}</div>
          {confirmDelete && item && <div className="portal-confirm"><p>Удалить «{item.title}» из каталога?</p><div className="portal-actions">
            <Action className="is-danger" disabled={pending} onClick={() => void change({ action: isQuest ? "deleteQuest" : "deleteEvent", id: item.id })}>Подтвердить удаление</Action>
            <Action onClick={() => setConfirmDelete(false)}>Отмена</Action></div></div>}
          <FormError error={error} />
        </form>
      </section>
    </div>
  </>;
}
