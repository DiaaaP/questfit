"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy, Crown, Flag, Mountain, Users } from "lucide-react";
import { toast } from "sonner";
import type { TeamData, TeamMember } from "@/shared/questfit";
import { Action, api, Back, Empty, Field, FormError, formatNumber as num, Go, Meter, navigate, NeedAccount, readLocal, Stat, type Athlete } from "./portal-ui";

const storageKey = "qf_pages_team";
type TeamAction =
  | { action: "create"; name: string; goalKm: number }
  | { action: "join"; code: string }
  | { action: "contribute"; distanceKm: number }
  | { action: "kick" | "transfer"; userId: number }
  | { action: "leave" };

function initialMember(user: Athlete, role: TeamMember["role"]): TeamMember {
  return { userId: user.id, name: user.fullName, role, contributionKm: 0, xp: 0, joinedAt: Date.now() };
}

function localAction(team: TeamData | null, user: Athlete, input: TeamAction): TeamData | null {
  if (input.action === "create" || input.action === "join") {
    if (team) throw new Error("Сначала выйдите из текущей команды.");
    if (input.action === "create") return {
      id: Date.now(), name: input.name, code: Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join(""),
      goalKm: input.goalKm, totalKm: 0, leaderId: user.id, members: [initialMember(user, "leader")],
    };
    if (input.code.toUpperCase() !== "URAL25") throw new Error("В браузерном демо доступен код URAL25.");
    return {
      id: -1, name: "Северный ветер", code: "URAL25", goalKm: 100, totalKm: 42, leaderId: -2,
      members: [{ userId: -2, name: "Кира Мороз", role: "leader", contributionKm: 42, xp: 1680, joinedAt: Date.now() }, initialMember(user, "member")],
    };
  }
  if (!team) throw new Error("Сначала вступите в команду.");
  if (input.action === "leave") return null;
  let members: TeamMember[];
  let leaderId = team.leaderId;
  if (input.action === "contribute") {
    members = team.members.map((member) => member.userId === user.id
      ? { ...member, contributionKm: Math.round((member.contributionKm + input.distanceKm) * 10) / 10, xp: member.xp + Math.round(input.distanceKm * 40) }
      : member);
  } else {
    if (leaderId !== user.id || input.userId === user.id) throw new Error("Управление доступно лидеру команды.");
    if (input.action === "kick") members = team.members.filter((member) => member.userId !== input.userId);
    else {
      leaderId = input.userId;
      members = team.members.map((member) => ({ ...member, role: member.userId === leaderId ? "leader" : "member" }));
    }
  }
  return { ...team, leaderId, members, totalKm: members.reduce((sum, member) => sum + member.contributionKm, 0) };
}

export function useTeam(user: Athlete | null, staticMode: boolean) {
  const [state, setState] = useState<{ owner: number; team: TeamData | null; error?: string } | null>(null);
  const id = user?.id;
  useEffect(() => {
    if (!id) return;
    let active = true;
    const source = staticMode ? Promise.resolve({ team: readLocal<TeamData | null>(storageKey, null) }) : api<{ team: TeamData | null }>("/api/team");
    source.then(({ team }) => active && setState({ owner: id, team }))
      .catch((reason) => active && setState({ owner: id, team: null, error: reason instanceof Error ? reason.message : "Не удалось загрузить команду." }));
    return () => { active = false; };
  }, [id, staticMode]);
  const current = id && state?.owner === id ? state : null;
  const team = current?.team ?? null;
  async function perform(input: TeamAction) {
    if (!user) throw new Error("Войдите в QuestFit.");
    const next = staticMode ? localAction(team, user, input) : (await api<{ team: TeamData | null }>("/api/team", "POST", input)).team;
    if (staticMode) localStorage.setItem(storageKey, JSON.stringify(next));
    setState({ owner: user.id, team: next });
    toast.success(input.action === "contribute" ? "Вклад добавлен" : "Команда обновлена");
  }
  return { team, perform, teamLoading: Boolean(user && !current), teamError: current?.error ?? "" };
}

export function TeamManager({
  view, user, team, perform, teamLoading, teamError, staticMode,
}: ReturnType<typeof useTeam> & { view: string; user: Athlete | null; staticMode: boolean }) {
  const [distance, setDistance] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<{ description: string; input: TeamAction } | null>(null);

  async function run(input: TeamAction, target?: string) {
    setError(""); setPending(true);
    try { await perform(input); setConfirm(null); if (target) navigate(target); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Действие не выполнено."); }
    finally { setPending(false); }
  }

  if (!user) return <NeedAccount description="Аккаунт нужен для вступления в команду и сохранения вклада в общий рейд." />;
  if (teamLoading) return <Empty title="Загрузка команды" text="Получаем ваш состав и прогресс рейда." />;
  if (teamError) return <Empty title="Команда недоступна" text={teamError}><Action onClick={() => window.location.reload()}>Повторить</Action></Empty>;

  const currentUser = user;
  if (view === "create" || view === "join") {
    if (team) return <Empty title={team.name} text="Вы уже в команде. Чтобы вступить в другую, сначала покиньте текущую."><Go to="team/roster">Открыть состав</Go></Empty>;
    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const name = String(values.get("name") ?? "").trim();
      const code = String(values.get("code") ?? "").trim().toUpperCase();
      if (view === "create" && name.length < 2) { setError("Укажите название команды."); return; }
      void run(view === "create" ? { action: "create", name, goalKm: Number(values.get("goalKm")) } : { action: "join", code }, "team/roster");
    }
    return <><Back to="team">Команда</Back><div className="portal-columns">
      <form className="portal-panel portal-form" onSubmit={submit}>
        <h2>{view === "create" ? "Новая команда" : "Приглашение"}</h2>
        {view === "create" ? <>
          <Field label="Название команды"><input name="name" minLength={2} maxLength={60} placeholder="Например, Алатау" required /></Field>
          <Field label="Цель рейда, км"><input name="goalKm" type="number" min={10} max={10000} defaultValue={100} required /></Field>
        </> : <Field label="Код команды" hint={staticMode ? "Демонстрационный код URAL25" : "Код можно получить у любого участника команды."}><input name="code" minLength={4} maxLength={12} placeholder="Введите код" required /></Field>}
        <FormError error={error} /><Action type="submit" primary disabled={pending}>{pending ? "Сохранение…" : view === "create" ? "Создать команду" : "Вступить в команду"}</Action>
      </form>
      <aside className="portal-panel portal-side-info"><Users size={25} aria-hidden="true" /><h2>{view === "create" ? "Вы будете лидером" : "Тренируйтесь вместе"}</h2>
        <p>{view === "create" ? "После создания можно скопировать приглашение, собрать состав и начать рейд." : "Каждый участник может вносить километры в общую цель команды."}</p></aside>
    </div></>;
  }
  if (!team) return <section className="portal-spotlight"><div className="portal-spotlight-copy">
    <span className="portal-chip"><Users size={16} aria-hidden="true" /> Командные рейды</span>
    <h2>Соберите свою команду</h2><p>Складывайте километры с участниками и приближайтесь к общей цели.</p>
    <div className="portal-actions"><Go to="team/create" primary>Создать команду</Go><Go to="team/join">Вступить по коду</Go></div>
  </div></section>;

  const contribution = team.members.find((member) => member.userId === user.id)?.contributionKm ?? 0;
  const ratio = team.totalKm / team.goalKm * 100;
  if (view === "contribute") return <>
    <Back to="team/raid">Командный рейд</Back>
    <div className="portal-columns">
      <form className="portal-panel portal-form" onSubmit={(e) => { e.preventDefault(); void run({ action: "contribute", distanceKm: Number(distance) }, "team/raid"); }}>
        <h2>Вклад в рейд</h2><Field label="Дистанция, км" hint="Укажите расстояние, которое вы уже преодолели."><input type="number" step=".1" min=".1" max={300} value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="0,0" required /></Field>
        <FormError error={error} /><Action primary type="submit" disabled={pending}>{pending ? "Сохранение…" : "Подтвердить вклад"}</Action>
      </form>
      <aside className="portal-panel portal-side-info"><Flag size={23} aria-hidden="true" /><h2>{team.name}</h2>
        <p>{num(team.totalKm)} → {num(team.totalKm + (Number(distance) || 0))} км из {num(team.goalKm)} км</p>
        <Meter value={(team.totalKm + (Number(distance) || 0)) / team.goalKm * 100} label="Ожидаемый результат" /></aside>
    </div>
  </>;

  if (view === "roster") return <>
    <Back to="team">Команда</Back>
    <section className="portal-panel"><div className="portal-section-head"><h2>{team.name}</h2>
      <Action onClick={async () => {
        try { await navigator.clipboard.writeText(team.code); toast.success("Код скопирован"); }
        catch { toast.error(`Код команды: ${team.code}`); }
      }}><Copy size={16} aria-hidden="true" /> {team.code}</Action></div>
      <div className="portal-rows">{team.members.map((member) => <div className="portal-row portal-member" key={member.userId}>
        <span className="portal-icon">{member.name.slice(0, 2).toUpperCase()}</span>
        <span><strong>{member.name}{member.userId === currentUser.id ? " · вы" : ""}</strong><small>{num(member.contributionKm)} км · {member.xp} XP</small></span>
        {member.role === "leader" ? <span className="portal-chip"><Crown size={15} aria-hidden="true" /> Лидер</span> : team.leaderId === currentUser.id ? <div className="portal-actions">
          <Action disabled={pending} onClick={() => setConfirm({ description: `Передать лидерство участнику «${member.name}»?`, input: { action: "transfer", userId: member.userId } })}>Передать роль</Action>
          <Action className="is-danger" disabled={pending} onClick={() => setConfirm({ description: `Исключить участника «${member.name}»?`, input: { action: "kick", userId: member.userId } })}>Исключить</Action>
        </div> : <span className="portal-muted">Участник</span>}
      </div>)}</div>
      <div className="portal-actions"><Go to="team/raid" primary>К рейду</Go><Action className="is-danger" onClick={() => setConfirm({ description: "Покинуть команду?", input: { action: "leave" } })}>Покинуть команду</Action></div>
      {confirm && <div className="portal-confirm"><p>{confirm.description}</p><div className="portal-actions">
        <Action primary disabled={pending} onClick={() => void run(confirm.input, confirm.input.action === "leave" ? "team" : undefined)}>Подтвердить</Action>
        <Action disabled={pending} onClick={() => setConfirm(null)}>Отмена</Action>
      </div></div>}<FormError error={error} />
    </section>
  </>;

  return <>
    {view === "raid" && <Back to="team">Команда</Back>}
    <section className="portal-spotlight"><div className="portal-spotlight-copy">
      <span className="portal-chip"><Mountain size={16} aria-hidden="true" /> Командный рейд</span><h2>{team.name}</h2>
      <p>{num(team.totalKm)} из {num(team.goalKm)} км · {ratio >= 100 ? "Цель достигнута" : `осталось ${num(team.goalKm - team.totalKm)} км`}</p>
      <Meter value={ratio} label="Общая цель рейда" /><div className="portal-actions">
        <Go to={view === "raid" ? "team/contribute" : "team/raid"} primary>{view === "raid" ? "Добавить вклад" : "Открыть рейд"}</Go><Go to="team/roster">Состав команды</Go>
      </div>
    </div></section>
    <div className="portal-stat-grid"><Stat label="Личный вклад" value={`${num(contribution)} км`} /><Stat label="Состав" value={team.members.length} /><Stat label="Выполнение цели" value={`${Math.round(ratio)}%`} /></div>
  </>;
}
