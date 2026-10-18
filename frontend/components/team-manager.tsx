"use client";

import { FormEvent, useEffect, useState } from "react";
import { Copy, Crown, LogOut, Plus, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamData } from "@/shared/questfit";

type TeamUser = { id: number; fullName: string } | null;

type TeamManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: TeamUser;
  staticMode: boolean;
  onTeamChange: (team: TeamData | null) => void;
};

const teamStorageKey = "qf_pages_team";

function demoTeam(user: NonNullable<TeamUser>): TeamData {
  const now = Date.now();
  return {
    id: 1,
    name: "Северный ветер",
    code: "URAL25",
    goalKm: 100,
    totalKm: 78,
    leaderId: user.id,
    members: [
      { userId: user.id, name: user.fullName, role: "leader", contributionKm: 29.6, xp: 1184, joinedAt: now - 86400000 * 20 },
      { userId: -2, name: "Кира Мороз", role: "member", contributionKm: 19.2, xp: 768, joinedAt: now - 86400000 * 16 },
      { userId: -3, name: "Роман Волков", role: "member", contributionKm: 17.4, xp: 696, joinedAt: now - 86400000 * 12 },
      { userId: -4, name: "Алекс Ким", role: "member", contributionKm: 11.8, xp: 472, joinedAt: now - 86400000 * 8 },
    ],
  };
}

function createCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function TeamManager({ open, onOpenChange, user, staticMode, onTeamChange }: TeamManagerProps) {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- team state is hydrated from local storage or the authenticated API. */
  useEffect(() => {
    if (!user) {
      setTeam(null);
      onTeamChange(null);
      return;
    }
    if (staticMode) {
      const saved = window.localStorage.getItem(teamStorageKey);
      const next = saved === null ? demoTeam(user) : JSON.parse(saved) as TeamData | null;
      if (saved === null) window.localStorage.setItem(teamStorageKey, JSON.stringify(next));
      setTeam(next);
      onTeamChange(next);
      return;
    }
    let active = true;
    fetch("/api/team")
      .then(async (response) => {
        const result = (await response.json()) as { team?: TeamData | null; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить команду.");
        return result.team ?? null;
      })
      .then((next) => {
        if (!active) return;
        setTeam(next);
        onTeamChange(next);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Ошибка загрузки команды."));
    return () => { active = false; };
  }, [onTeamChange, staticMode, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function commitStatic(next: TeamData | null) {
    window.localStorage.setItem(teamStorageKey, JSON.stringify(next));
    setTeam(next);
    onTeamChange(next);
  }

  async function perform(action: Record<string, unknown>) {
    if (!user) throw new Error("Войдите, чтобы управлять командой.");
    setLoading(true);
    setError("");
    try {
      if (staticMode) {
        let next = team;
        if (action.action === "create") {
          if (team) throw new Error("Сначала выйдите из текущей команды.");
          next = {
            id: Date.now(),
            name: String(action.name),
            code: createCode(),
            goalKm: Number(action.goalKm),
            totalKm: 0,
            leaderId: user.id,
            members: [{ userId: user.id, name: user.fullName, role: "leader", contributionKm: 0, xp: 0, joinedAt: Date.now() }],
          };
        } else if (action.action === "join") {
          if (team) throw new Error("Вы уже состоите в команде.");
          if (String(action.code).trim().toUpperCase() !== "URAL25") throw new Error("Для демо используйте код URAL25.");
          next = demoTeam(user);
          next = { ...next, leaderId: -2, members: next.members.map((member) => member.userId === user.id ? { ...member, role: "member" } : member) };
        } else if (action.action === "contribute" && team) {
          const distanceKm = Number(action.distanceKm);
          next = {
            ...team,
            totalKm: Math.round((team.totalKm + distanceKm) * 10) / 10,
            members: team.members.map((member) => member.userId === user.id
              ? { ...member, contributionKm: Math.round((member.contributionKm + distanceKm) * 10) / 10, xp: member.xp + Math.round(distanceKm * 40) }
              : member),
          };
        } else if (action.action === "kick" && team) {
          next = { ...team, members: team.members.filter((member) => member.userId !== Number(action.userId)) };
        } else if (action.action === "leave") next = null;
        commitStatic(next);
      } else {
        const response = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const result = (await response.json()) as { team?: TeamData | null; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Не удалось выполнить действие.");
        setTeam(result.team ?? null);
        onTeamChange(result.team ?? null);
      }
      toast.success(action.action === "contribute" ? "Вклад команды обновлён" : "Команда обновлена");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Не удалось выполнить действие.";
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform({ action: "create", name: String(form.get("name")), goalKm: Number(form.get("goalKm")) }).catch(() => undefined);
  }

  async function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform({ action: "join", code: String(form.get("code")) }).catch(() => undefined);
  }

  async function submitContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await perform({ action: "contribute", distanceKm: Number(form.get("distanceKm")) }).catch(() => undefined);
    event.currentTarget.reset();
  }

  const isLeader = Boolean(user && team?.leaderId === user.id);
  const progress = team ? Math.min(100, Math.round((team.totalKm / team.goalKm) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="qf-info-dialog qf-team-dialog">
        <DialogHeader>
          <DialogTitle>{team ? team.name : "Найти свою команду"}</DialogTitle>
          <DialogDescription>{team ? "Участники, общий рейд и управление составом." : "Создайте отряд или вступите по коду приглашения."}</DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="qf-team-empty"><Users aria-hidden="true" /><p>Войдите в аккаунт, чтобы создавать команды и участвовать в рейдах.</p></div>
        ) : team ? (
          <div className="qf-team-manager">
            <div className="qf-team-summary">
              <div><span><Shield aria-hidden="true" /></span><p><small>КОМАНДНЫЙ РЕЙД</small><b>{team.totalKm.toLocaleString("ru-RU")} / {team.goalKm} км</b></p><strong>{progress}%</strong></div>
              <Progress value={progress} className="qf-raid-progress" />
              <button onClick={() => { void navigator.clipboard.writeText(team.code); toast.success("Код команды скопирован"); }}><Copy aria-hidden="true" /> Код приглашения: <b>{team.code}</b></button>
            </div>

            <form className="qf-team-contribution" onSubmit={submitContribution}>
              <div><Label htmlFor="team-distance">Добавить вклад</Label><Input id="team-distance" name="distanceKm" type="number" min={0.1} max={300} step="0.1" placeholder="Километры" required /></div>
              <Button type="submit" disabled={loading}><Plus aria-hidden="true" /> Добавить</Button>
            </form>

            <div className="qf-team-member-list">
              {team.members.map((member) => (
                <div key={member.userId}>
                  <span>{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                  <p><b>{member.name} {member.userId === user.id ? "· вы" : ""}</b><small>{member.contributionKm.toLocaleString("ru-RU")} км · {member.xp} XP</small></p>
                  {member.role === "leader" ? <strong><Crown aria-hidden="true" /> Лидер</strong> : isLeader ? <button onClick={() => void perform({ action: "kick", userId: member.userId })} aria-label={`Исключить ${member.name}`}><Trash2 aria-hidden="true" /></button> : <small>Участник</small>}
                </div>
              ))}
            </div>
            {error && <p className="qf-auth-error" role="alert">{error}</p>}
            <button className="qf-team-leave" disabled={loading} onClick={() => void perform({ action: "leave" })}><LogOut aria-hidden="true" /> Выйти из команды</button>
          </div>
        ) : (
          <Tabs defaultValue="create">
            <TabsList className="qf-auth-tabs"><TabsTrigger value="create">Создать</TabsTrigger><TabsTrigger value="join">Вступить</TabsTrigger></TabsList>
            <TabsContent value="create">
              <form className="qf-workout-form qf-team-form" onSubmit={submitCreate}>
                <div className="qf-field"><Label htmlFor="team-name">Название команды</Label><Input id="team-name" name="name" placeholder="Например, Уральский ритм" minLength={2} maxLength={60} required /></div>
                <div className="qf-field"><Label htmlFor="team-goal">Цель рейда, км</Label><Input id="team-goal" name="goalKm" type="number" min={10} max={10000} defaultValue={100} required /></div>
                <Button type="submit" className="qf-sheet-action" disabled={loading}><Users aria-hidden="true" /> Создать команду</Button>
              </form>
            </TabsContent>
            <TabsContent value="join">
              <form className="qf-workout-form qf-team-form" onSubmit={submitJoin}>
                <div className="qf-field"><Label htmlFor="team-code">Код приглашения</Label><Input id="team-code" name="code" placeholder="Например, URAL25" minLength={4} maxLength={12} required /></div>
                <p className="qf-team-hint">Демонстрационный код: <b>URAL25</b></p>
                <Button type="submit" className="qf-sheet-action" disabled={loading}><UserPlus aria-hidden="true" /> Вступить в команду</Button>
              </form>
            </TabsContent>
            {error && <p className="qf-auth-error" role="alert">{error}</p>}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
