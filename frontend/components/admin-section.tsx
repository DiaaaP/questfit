"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Check, CircleOff, Plus, ShieldCheck, Trash2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminData, AdminEvent, AdminQuest } from "@/shared/questfit";

type AdminSectionProps = {
  user: { id: number; fullName: string; email: string; goal: string } | null;
  staticMode: boolean;
};

const adminStorageKey = "qf_pages_admin";
const defaultEventDate = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16);

function initialAdminData(user: NonNullable<AdminSectionProps["user"]>): AdminData {
  return {
    users: [
      { id: user.id, fullName: user.fullName, email: user.email, goal: user.goal, createdAt: Date.now() - 86400000 * 12, workoutCount: 4, teamName: "Северный ветер" },
      { id: -2, fullName: "Кира Мороз", email: "kira@questfit.demo", goal: "Полумарафон", createdAt: Date.now() - 86400000 * 28, workoutCount: 18, teamName: "Северный ветер" },
      { id: -3, fullName: "Роман Волков", email: "roman@questfit.demo", goal: "Сила и выносливость", createdAt: Date.now() - 86400000 * 35, workoutCount: 22, teamName: "Северный ветер" },
    ],
    quests: [
      { id: 1, title: "Силовой импульс", detail: "45 минут · верх тела", xp: 240, active: true },
      { id: 2, title: "Кардио-разгон", detail: "Пробеги 5 км", xp: 320, active: true },
      { id: 3, title: "Точная серия", detail: "8 000 шагов до 21:00", xp: 180, active: true },
    ],
    events: [
      { id: 1, slug: "night-run-ural", title: "Night Run: Урал", location: "Набережная городского пруда", distanceKm: 10, startAt: Date.now() + 86400000 * 5, rewardXp: 1200, capacity: 350, active: true, registrations: 286 },
    ],
  };
}

function slugify(value: string) {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `event-${Date.now()}`;
}

export function AdminSection({ user, staticMode }: AdminSectionProps) {
  const [data, setData] = useState<AdminData | null>(null);
  const [accessError, setAccessError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createType, setCreateType] = useState<"quest" | "event" | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- admin state is hydrated from local storage or the authenticated API. */
  useEffect(() => {
    if (!user) {
      setData(null);
      setAccessError("");
      return;
    }
    if (staticMode) {
      const saved = window.localStorage.getItem(adminStorageKey);
      const next = saved ? JSON.parse(saved) as AdminData : initialAdminData(user);
      if (!saved) window.localStorage.setItem(adminStorageKey, JSON.stringify(next));
      setData(next);
      return;
    }
    let active = true;
    fetch("/api/admin")
      .then(async (response) => {
        const result = (await response.json()) as AdminData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Не удалось открыть админ-панель.");
        return result;
      })
      .then((next) => active && setData(next))
      .catch((reason) => active && setAccessError(reason instanceof Error ? reason.message : "Нет доступа."));
    return () => { active = false; };
  }, [staticMode, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function action(payload: Record<string, unknown>) {
    if (!data) return;
    setLoading(true);
    try {
      if (staticMode) {
        let next = data;
        if (payload.action === "createQuest") {
          next = { ...data, quests: [{ id: Math.max(0, ...data.quests.map((quest) => quest.id)) + 1, title: String(payload.title), detail: String(payload.detail), xp: Number(payload.xp), active: true }, ...data.quests] };
        } else if (payload.action === "updateQuest") {
          next = { ...data, quests: data.quests.map((quest) => quest.id === Number(payload.id) ? payload as unknown as AdminQuest : quest) };
        } else if (payload.action === "deleteQuest") {
          next = { ...data, quests: data.quests.filter((quest) => quest.id !== Number(payload.id)) };
        } else if (payload.action === "createEvent") {
          next = { ...data, events: [{ id: Math.max(0, ...data.events.map((item) => item.id)) + 1, registrations: 0, ...(payload as unknown as Omit<AdminEvent, "id" | "registrations">) }, ...data.events] };
        } else if (payload.action === "updateEvent") {
          next = { ...data, events: data.events.map((event) => event.id === Number(payload.id) ? { ...event, ...(payload as unknown as AdminEvent) } : event) };
        } else if (payload.action === "deleteEvent") {
          next = { ...data, events: data.events.filter((event) => event.id !== Number(payload.id)) };
        }
        window.localStorage.setItem(adminStorageKey, JSON.stringify(next));
        setData(next);
      } else {
        const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const result = (await response.json()) as AdminData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Не удалось сохранить изменения.");
        setData(result);
      }
      toast.success("Изменения сохранены");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Не удалось сохранить изменения.");
    } finally {
      setLoading(false);
    }
  }

  async function createQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({ action: "createQuest", title: String(form.get("title")), detail: String(form.get("detail")), xp: Number(form.get("xp")), active: true });
    setCreateType(null);
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    await action({
      action: "createEvent",
      slug: slugify(title),
      title,
      location: String(form.get("location")),
      distanceKm: Number(form.get("distanceKm")),
      startAt: new Date(String(form.get("startAt"))).getTime(),
      rewardXp: Number(form.get("rewardXp")),
      capacity: Number(form.get("capacity")),
      active: true,
    });
    setCreateType(null);
  }

  return (
    <section className="qf-section qf-admin-section" id="admin">
      <div className="qf-section-head qf-admin-head">
        <div><span className="qf-kicker">CONTROL CENTER</span><h2>Админ-панель</h2></div>
        <span className="qf-admin-badge"><ShieldCheck aria-hidden="true" /> Режим владельца</span>
      </div>

      {!user ? (
        <div className="qf-panel qf-admin-locked"><ShieldCheck aria-hidden="true" /><div><h3>Требуется авторизация</h3><p>Войдите в аккаунт владельца, чтобы управлять квестами, событиями и пользователями.</p></div></div>
      ) : accessError ? (
        <div className="qf-panel qf-admin-locked"><CircleOff aria-hidden="true" /><div><h3>Доступ ограничен</h3><p>{accessError}</p></div></div>
      ) : !data ? (
        <div className="qf-panel qf-admin-locked"><ShieldCheck aria-hidden="true" /><div><h3>Загрузка панели…</h3><p>Получаем данные проекта.</p></div></div>
      ) : (
        <>
          <div className="qf-admin-metrics">
            <article><Users aria-hidden="true" /><span><small>Пользователи</small><b>{data.users.length}</b></span></article>
            <article><Zap aria-hidden="true" /><span><small>Квесты</small><b>{data.quests.filter((quest) => quest.active).length} активных</b></span></article>
            <article><CalendarDays aria-hidden="true" /><span><small>События</small><b>{data.events.length}</b></span></article>
          </div>

          <div className="qf-admin-grid">
            <article className="qf-panel qf-admin-card">
              <div className="qf-panel-head"><div><span className="qf-kicker">QUEST EDITOR</span><h2>Квесты</h2></div><button onClick={() => setCreateType("quest")}><Plus aria-hidden="true" /> Новый</button></div>
              <div className="qf-admin-list">
                {data.quests.map((quest) => (
                  <div className={!quest.active ? "inactive" : ""} key={quest.id}>
                    <span><Zap aria-hidden="true" /></span>
                    <p><b>{quest.title}</b><small>{quest.detail}</small></p>
                    <div className="qf-admin-xp"><button disabled={loading || quest.xp <= 50} onClick={() => void action({ action: "updateQuest", ...quest, xp: quest.xp - 50 })}>−</button><strong>{quest.xp} XP</strong><button disabled={loading} onClick={() => void action({ action: "updateQuest", ...quest, xp: quest.xp + 50 })}>+</button></div>
                    <button className="qf-admin-toggle" onClick={() => void action({ action: "updateQuest", ...quest, active: !quest.active })}>{quest.active ? <Check aria-hidden="true" /> : <CircleOff aria-hidden="true" />}</button>
                    <button className="qf-admin-delete" onClick={() => void action({ action: "deleteQuest", id: quest.id })}><Trash2 aria-hidden="true" /></button>
                  </div>
                ))}
                {data.quests.length === 0 && <p className="qf-admin-empty">Создайте первый управляемый квест.</p>}
              </div>
            </article>

            <article className="qf-panel qf-admin-card">
              <div className="qf-panel-head"><div><span className="qf-kicker">EVENT MANAGER</span><h2>Соревнования</h2></div><button onClick={() => setCreateType("event")}><Plus aria-hidden="true" /> Новое</button></div>
              <div className="qf-admin-list qf-event-admin-list">
                {data.events.map((item) => (
                  <div className={!item.active ? "inactive" : ""} key={item.id}>
                    <span><CalendarDays aria-hidden="true" /></span>
                    <p><b>{item.title}</b><small>{item.location} · {item.distanceKm} км · {item.registrations}/{item.capacity}</small></p>
                    <div className="qf-admin-xp"><button disabled={loading || item.rewardXp <= 100} onClick={() => void action({ action: "updateEvent", ...item, rewardXp: item.rewardXp - 100 })}>−</button><strong>{item.rewardXp} XP</strong><button disabled={loading} onClick={() => void action({ action: "updateEvent", ...item, rewardXp: item.rewardXp + 100 })}>+</button></div>
                    <button className="qf-admin-toggle" onClick={() => void action({ action: "updateEvent", ...item, active: !item.active })}>{item.active ? <Check aria-hidden="true" /> : <CircleOff aria-hidden="true" />}</button>
                    <button className="qf-admin-delete" onClick={() => void action({ action: "deleteEvent", id: item.id })}><Trash2 aria-hidden="true" /></button>
                  </div>
                ))}
                {data.events.length === 0 && <p className="qf-admin-empty">Добавьте первое соревнование.</p>}
              </div>
            </article>
          </div>

          <article className="qf-panel qf-admin-users">
            <div className="qf-panel-head"><div><span className="qf-kicker">USER DIRECTORY</span><h2>Зарегистрированные пользователи</h2></div><span>{data.users.length} аккаунта</span></div>
            <div className="qf-user-table">
              <div className="qf-user-table-head"><span>Пользователь</span><span>Цель</span><span>Команда</span><span>Тренировки</span></div>
              {data.users.map((item) => <div key={item.id}><p><b>{item.fullName}</b><small>{item.email}</small></p><span>{item.goal}</span><span>{item.teamName ?? "Без команды"}</span><strong>{item.workoutCount}</strong></div>)}
            </div>
          </article>
        </>
      )}

      <Dialog open={createType !== null} onOpenChange={(open) => !open && setCreateType(null)}>
        <DialogContent className="qf-info-dialog qf-admin-create-dialog">
          <DialogHeader><DialogTitle>{createType === "quest" ? "Новый квест" : "Новое соревнование"}</DialogTitle><DialogDescription>После сохранения запись появится в панели управления.</DialogDescription></DialogHeader>
          {createType === "quest" ? (
            <form className="qf-workout-form" onSubmit={createQuest}>
              <div className="qf-field"><Label htmlFor="admin-quest-title">Название</Label><Input id="admin-quest-title" name="title" minLength={2} maxLength={80} required /></div>
              <div className="qf-field"><Label htmlFor="admin-quest-detail">Условие</Label><Input id="admin-quest-detail" name="detail" minLength={2} maxLength={160} required /></div>
              <div className="qf-field"><Label htmlFor="admin-quest-xp">Награда XP</Label><Input id="admin-quest-xp" name="xp" type="number" min={10} max={10000} defaultValue={250} required /></div>
              <Button type="submit" className="qf-sheet-action" disabled={loading}>Создать квест</Button>
            </form>
          ) : (
            <form className="qf-workout-form" onSubmit={createEvent}>
              <div className="qf-field"><Label htmlFor="admin-event-title">Название</Label><Input id="admin-event-title" name="title" minLength={2} maxLength={100} required /></div>
              <div className="qf-field"><Label htmlFor="admin-event-location">Место</Label><Input id="admin-event-location" name="location" minLength={2} maxLength={120} required /></div>
              <div className="qf-form-pair"><div className="qf-field"><Label htmlFor="admin-event-distance">Дистанция, км</Label><Input id="admin-event-distance" name="distanceKm" type="number" min={0.1} max={1000} step="0.1" defaultValue={10} required /></div><div className="qf-field"><Label htmlFor="admin-event-date">Дата и время</Label><Input id="admin-event-date" name="startAt" type="datetime-local" defaultValue={defaultEventDate} required /></div></div>
              <div className="qf-form-pair"><div className="qf-field"><Label htmlFor="admin-event-xp">Награда XP</Label><Input id="admin-event-xp" name="rewardXp" type="number" min={10} max={100000} defaultValue={1000} required /></div><div className="qf-field"><Label htmlFor="admin-event-capacity">Количество мест</Label><Input id="admin-event-capacity" name="capacity" type="number" min={1} max={100000} defaultValue={200} required /></div></div>
              <Button type="submit" className="qf-sheet-action" disabled={loading}>Создать соревнование</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
