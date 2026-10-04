"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Medal,
  Menu,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Route,
  Trophy,
  UserRound,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type User = {
  id: number;
  fullName: string;
  email: string;
  goal: string;
};

type StaticAccount = {
  user: User;
  passwordHash: string;
};

const staticKeys = {
  account: "qf_pages_account",
  session: "qf_pages_session",
  completed: "qf_pages_completed",
  event: "qf_pages_event_joined",
};

function isGitHubPages() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith("github.io") || document.documentElement.dataset.deployment === "github-pages")
  );
}

async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const quests = [
  { id: 1, icon: Dumbbell, title: "Силовой импульс", detail: "45 минут · верх тела", xp: 240, tone: "ember" },
  { id: 2, icon: Activity, title: "Кардио-разгон", detail: "Пробеги 5 км", xp: 320, tone: "blue" },
  { id: 3, icon: Target, title: "Точная серия", detail: "8 000 шагов до 21:00", xp: 180, tone: "green" },
  { id: 4, icon: Users, title: "Отрядный бонус", detail: "Тренировка с напарником", xp: 450, tone: "violet" },
];

const navItems = [
  { href: "#overview", label: "Обзор", icon: LayoutDashboard },
  { href: "#quests", label: "Квесты", icon: ScrollText },
  { href: "#squad", label: "Команда", icon: Users },
  { href: "#arena", label: "Арена", icon: Trophy },
];

const week = [
  { day: "ПН", value: 74 },
  { day: "ВТ", value: 56 },
  { day: "СР", value: 91 },
  { day: "ЧТ", value: 68 },
  { day: "ПТ", value: 82 },
  { day: "СБ", value: 45 },
  { day: "ВС", value: 22, current: true },
];

export function QuestFitApp() {
  const [completed, setCompleted] = useState<number[]>([3]);
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authMode, setAuthMode] = useState("register");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [arenaOpen, setArenaOpen] = useState(false);
  const [squadOpen, setSquadOpen] = useState(false);
  const [squadBoost, setSquadBoost] = useState(0);
  const [proEnabled, setProEnabled] = useState(false);
  const [eventJoined, setEventJoined] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isGitHubPages()) {
      try {
        const account = JSON.parse(window.localStorage.getItem(staticKeys.account) ?? "null") as StaticAccount | null;
        const hasSession = window.localStorage.getItem(staticKeys.session) === "true";
        if (account && hasSession) setUser(account.user);
        const savedCompleted = JSON.parse(window.localStorage.getItem(staticKeys.completed) ?? "[3]") as number[];
        setCompleted(Array.isArray(savedCompleted) ? savedCompleted : [3]);
        setEventJoined(window.localStorage.getItem(staticKeys.event) === "true");
      } catch {
        setCompleted([3]);
      }
      setSessionReady(true);
      return;
    }
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => (await response.json()) as { user?: User | null })
      .then((data) => {
        if (!active) return;
        setUser(data.user ?? null);
        setSessionReady(true);
        if (!data.user) setEventJoined(window.localStorage.getItem("qf_guest_event_joined") === "true");
      })
      .catch(() => {
        if (!active) return;
        setSessionReady(true);
        setEventJoined(window.localStorage.getItem("qf_guest_event_joined") === "true");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isGitHubPages()) return;
    let active = true;
    fetch("/api/activity")
      .then(async (response) => {
        const result = (await response.json()) as {
          completedQuestIds?: number[];
          registeredForEvent?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить прогресс.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setCompleted(result.completedQuestIds ?? []);
        setEventJoined(Boolean(result.registeredForEvent));
      })
      .catch(() => active && toast.error("Не удалось загрузить сохранённый прогресс"));
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-22% 0px -60% 0px", threshold: [0, 0.15, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(
      modelContext.registerTool(
        {
          name: "complete_daily_quest",
          title: "Завершить дневной квест",
          description: "Отмечает один из видимых дневных квестов QuestFit выполненным и начисляет его XP.",
          inputSchema: {
            type: "object",
            properties: { questId: { type: "integer", minimum: 1, maximum: 4 } },
            required: ["questId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input: unknown) {
            const questId = Number((input as { questId?: unknown })?.questId);
            const quest = quests.find((item) => item.id === questId);
            if (!quest || !Number.isInteger(questId)) throw new Error("Неизвестный квест.");
            setCompleted((current) => {
              const next = current.includes(questId) ? current : [...current, questId];
              if (user && isGitHubPages()) window.localStorage.setItem(staticKeys.completed, JSON.stringify(next));
              return next;
            });
            if (user) {
              if (!isGitHubPages()) await fetch("/api/activity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "quest", questId, completed: true }),
              });
            }
            return { questId, title: quest.title, status: "completed", xp: quest.xp, saved: Boolean(user) };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, [user]);

  const xp = 6840 + completed.length * 140;
  const levelProgress = Math.min(94, 66 + completed.length * 5);
  const firstName = user?.fullName.split(" ")[0] ?? "Атлет";
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  function navigateTo(href: string) {
    const id = href.slice(1);
    setActiveSection(id);
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (id === "squad") setSquadOpen(true);
    if (id === "arena") setArenaOpen(true);
  }

  async function toggleQuest(id: number, title: string) {
    if (actionLoading) return;
    const wasCompleted = completed.includes(id);
    const nextCompleted = wasCompleted
      ? completed.filter((questId) => questId !== id)
      : [...completed, id];
    setCompleted(nextCompleted);

    if (!user) {
      toast(wasCompleted ? "Квест снова активен" : `Квест «${title}» закрыт`, {
        description: "Войдите, чтобы сохранить результат между устройствами.",
      });
      return;
    }

    if (isGitHubPages()) {
      window.localStorage.setItem(staticKeys.completed, JSON.stringify(nextCompleted));
      toast.success(wasCompleted ? "Квест возвращён в список" : `Квест «${title}» закрыт`, {
        description: "Прогресс сохранён в этом браузере.",
      });
      return;
    }

    setActionLoading(`quest-${id}`);
    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quest", questId: id, completed: !wasCompleted }),
      });
      const result = (await response.json()) as { completedQuestIds?: number[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось сохранить квест.");
      setCompleted(result.completedQuestIds ?? nextCompleted);
      toast.success(wasCompleted ? "Квест возвращён в список" : `Квест «${title}» закрыт`, {
        description: wasCompleted ? "XP пересчитан." : "Опыт сохранён в вашем профиле.",
      });
    } catch (error) {
      setCompleted(completed);
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить квест.");
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleEvent() {
    if (!user) {
      const nextValue = !eventJoined;
      setEventJoined(nextValue);
      window.localStorage.setItem("qf_guest_event_joined", String(nextValue));
      toast.success(nextValue ? "Место на Night Run закреплено" : "Запись на Night Run отменена", {
        description: nextValue ? "Гостевая запись сохранена на этом устройстве." : "Можно вернуться в список в любой момент.",
      });
      return;
    }
    if (isGitHubPages()) {
      const nextValue = !eventJoined;
      setEventJoined(nextValue);
      window.localStorage.setItem(staticKeys.event, String(nextValue));
      toast.success(nextValue ? "Вы в списке участников" : "Запись отменена", {
        description: "Статус сохранён в этом браузере.",
      });
      return;
    }
    if (actionLoading) return;
    const nextValue = !eventJoined;
    setEventJoined(nextValue);
    setActionLoading("event");
    try {
      const response = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "event", registered: nextValue }),
      });
      const result = (await response.json()) as { registeredForEvent?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось обновить запись.");
      setEventJoined(Boolean(result.registeredForEvent));
      toast.success(nextValue ? "Вы в списке участников" : "Запись отменена", {
        description: nextValue ? "Напомним за два часа до старта." : "Место снова доступно другим игрокам.",
      });
    } catch (error) {
      setEventJoined(!nextValue);
      toast.error(error instanceof Error ? error.message : "Не удалось обновить запись.");
    } finally {
      setActionLoading(null);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>, mode: "register" | "login") {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      fullName: data.get("fullName"),
      email: data.get("email"),
      password: data.get("password"),
      goal: "Баланс и выносливость",
    };

    try {
      if (isGitHubPages()) {
        const fullName = String(payload.fullName ?? "").trim();
        const email = String(payload.email ?? "").trim().toLowerCase();
        const password = String(payload.password ?? "");
        const savedAccount = JSON.parse(window.localStorage.getItem(staticKeys.account) ?? "null") as StaticAccount | null;
        const passwordHash = await hashPassword(password);

        let nextUser: User;
        if (mode === "register") {
          if (fullName.length < 2) throw new Error("Укажите имя.");
          if (!email.includes("@")) throw new Error("Проверьте адрес почты.");
          if (password.length < 6) throw new Error("Пароль должен содержать минимум 6 символов.");
          nextUser = { id: Date.now(), fullName, email, goal: payload.goal };
          window.localStorage.setItem(staticKeys.account, JSON.stringify({ user: nextUser, passwordHash } satisfies StaticAccount));
        } else {
          if (!savedAccount || savedAccount.user.email.toLowerCase() !== email || savedAccount.passwordHash !== passwordHash) {
            throw new Error("Неверная почта или пароль.");
          }
          nextUser = savedAccount.user;
        }

        window.localStorage.setItem(staticKeys.session, "true");
        setUser(nextUser);
        setAuthOpen(false);
        toast.success(mode === "register" ? "Добро пожаловать в QuestFit" : "С возвращением", {
          description: `${nextUser.fullName}, прогресс сохраняется в этом браузере.`,
        });
        return;
      }

      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { user?: User; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error ?? "Что-то пошло не так.");
      setUser(result.user);
      setAuthOpen(false);
      toast.success(mode === "register" ? "Добро пожаловать в QuestFit" : "С возвращением", {
        description: `${result.user.fullName}, ваша серия начинается сегодня.`,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось продолжить.");
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    if (isGitHubPages()) window.localStorage.removeItem(staticKeys.session);
    else await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setCompleted([3]);
    setEventJoined(
      window.localStorage.getItem(isGitHubPages() ? staticKeys.event : "qf_guest_event_joined") === "true",
    );
    setAuthMode("login");
    setAuthOpen(true);
    toast("Вы вышли из аккаунта");
  }

  return (
    <div className="qf-shell">
      <div className="qf-ambient qf-ambient-one" />
      <div className="qf-ambient qf-ambient-two" />

      <aside className={`qf-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="qf-brand">
          <span className="qf-brand-mark"><Swords aria-hidden="true" /></span>
          <span>QUEST<span>FIT</span></span>
        </div>
        <button className="qf-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню">
          <X aria-hidden="true" />
        </button>

        <p className="qf-nav-label">Игра</p>
        <nav className="qf-nav" aria-label="Основная навигация">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className={activeSection === href.slice(1) ? "active" : ""} onClick={(event) => { event.preventDefault(); navigateTo(href); }}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="qf-sidebar-spacer" />
        <button className="qf-sidebar-card" onClick={() => setSeasonOpen(true)} aria-label="Открыть прогресс PRO-сезона">
          <Sparkles aria-hidden="true" />
          <strong>PRO-сезон 04</strong>
          <span>{proEnabled ? "PRO-режим активен" : "В топ-12% игроков"}</span>
          <Progress value={72} className="qf-mini-progress" aria-label="Прогресс сезона: 72%" />
        </button>
        <button className="qf-support-link" onClick={() => setSupportOpen(true)}><HelpCircle aria-hidden="true" /> Помощь и поддержка</button>
      </aside>

      {mobileOpen && <button className="qf-scrim" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />}

      <main className="qf-main">
        <header className="qf-topbar">
          <div className="qf-heading-row">
            <button className="qf-menu-button" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">
              <Menu aria-hidden="true" />
            </button>
            <div>
              <p>{dateLabel}</p>
              <h1>Режим героя: <span>включён</span></h1>
            </div>
          </div>
          <div className="qf-top-actions">
            <button className="qf-icon-button" onClick={() => setNotificationsOpen(true)} aria-label="Уведомления"><Bell aria-hidden="true" />{!notificationsRead && <i />}</button>
            {user ? (
              <div className="qf-account">
                <button className="qf-profile-trigger" onClick={() => setProfileOpen(true)} aria-label="Открыть профиль">
                  <span className="qf-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
                  <span><b>{firstName}</b><small>ур. 24</small></span>
                </button>
                <button onClick={logout} aria-label="Выйти"><LogOut aria-hidden="true" /></button>
              </div>
            ) : (
              <Button className="qf-register-button" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>
                <UserPlus aria-hidden="true" /> Регистрация
              </Button>
            )}
          </div>
        </header>

        <section className="qf-hero-grid" id="overview" aria-label="Прогресс за сегодня">
          <article className="qf-level-card">
            <div className="qf-level-copy">
              <span className="qf-eyebrow"><Zap aria-hidden="true" /> Личный прогресс</span>
              <h2>{firstName}, сегодня<br />ты становишься <em>сильнее.</em></h2>
              <p>Ещё {Math.max(1, 3 - completed.length)} квеста до дневного комбо. Не рви темп — держи серию.</p>
              <div className="qf-xp-line"><span>До 25 уровня</span><b>{xp.toLocaleString("ru-RU")} / 8 000 XP</b></div>
              <Progress value={levelProgress} className="qf-level-progress" aria-label={`Прогресс уровня: ${levelProgress}%`} />
            </div>
            <div className="qf-level-orbit" style={{ "--progress": `${levelProgress * 3.6}deg` } as React.CSSProperties}>
              <div><small>УРОВЕНЬ</small><strong>24</strong><span>RANGER</span></div>
            </div>
          </article>

          <div className="qf-stat-stack">
            <article className="qf-stat-card hot"><Flame aria-hidden="true" /><div><small>Серия</small><strong>12 дней</strong><span>Личный рекорд: 18</span></div></article>
            <article className="qf-stat-card"><Medal aria-hidden="true" /><div><small>Рейтинг города</small><strong>#147</strong><span>+23 позиции за неделю</span></div></article>
          </div>
        </section>

        <section className="qf-section" id="quests">
          <div className="qf-section-head">
            <div><span className="qf-kicker">DAILY QUESTS</span><h2>Квесты на сегодня</h2></div>
            <div className="qf-completion"><span>{completed.length}/{quests.length}</span><small>выполнено</small></div>
          </div>
          <div className="qf-quest-grid">
            {quests.map((quest) => {
              const done = completed.includes(quest.id);
              const Icon = quest.icon;
              return (
                <article key={quest.id} className={`qf-quest-card ${done ? "done" : ""}`}>
                  <span className={`qf-quest-icon ${quest.tone}`}><Icon aria-hidden="true" /></span>
                  <div className="qf-quest-copy"><h3>{quest.title}</h3><p>{quest.detail}</p><b>+{quest.xp} XP</b></div>
                  <button disabled={actionLoading === `quest-${quest.id}`} onClick={() => toggleQuest(quest.id, quest.title)} aria-label={done ? `Вернуть квест ${quest.title}` : `Завершить квест ${quest.title}`}>
                    {done ? <Check aria-hidden="true" /> : <span />}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="qf-lower-grid">
          <article className="qf-panel qf-week-panel">
            <div className="qf-panel-head"><div><span className="qf-kicker">RHYTHM</span><h2>Ритм недели</h2></div><span className="qf-delta">+18%</span></div>
            <div className="qf-bars" aria-label="Активность за неделю">
              {week.map((item) => <div key={item.day} className={item.current ? "current" : ""}><span style={{ height: `${item.value}%` }} /><small>{item.day}</small></div>)}
            </div>
            <div className="qf-week-summary"><div><Activity aria-hidden="true" /><span><b>4 ч 20 мин</b><small>активности</small></span></div><div><Zap aria-hidden="true" /><span><b>1 860 XP</b><small>за неделю</small></span></div></div>
          </article>

          <article className="qf-panel qf-raid-panel" id="squad">
            <div className="qf-raid-top"><span className="qf-kicker">SQUAD RAID</span><span className="qf-timer"><Clock3 aria-hidden="true" /> 2д 14ч</span></div>
            <div className="qf-boss"><span><Swords aria-hidden="true" /></span><div><small>РАЙОННЫЙ БОСС</small><h2>Железный колосс</h2><p>{78 + squadBoost} / 100 км командой</p></div></div>
            <Progress value={78 + squadBoost} className="qf-raid-progress" aria-label={`Прогресс командного рейда: ${78 + squadBoost}%`} />
            <div className="qf-squad-row">
              <div className="qf-avatar-stack"><span>RV</span><span>KM</span><span>AK</span><span>+3</span></div>
              <b>До награды {22 - squadBoost} км</b>
            </div>
            <button className="qf-panel-action" onClick={() => setSquadOpen(true)}><Users aria-hidden="true" /> Открыть команду</button>
          </article>

          <article className="qf-panel qf-arena-panel" id="arena">
            <div className="qf-panel-head"><div><span className="qf-kicker">ARENA</span><h2>Ближайший старт</h2></div><Trophy aria-hidden="true" /></div>
            <h3>Night Run: Урал</h3>
            <p><MapPin aria-hidden="true" /> Набережная · 10 км</p>
            <div className="qf-arena-meta"><span><small>СТАРТ</small><b>19:30</b></span><span><small>ИГРОКОВ</small><b>{eventJoined ? 287 : 286}</b></span><span><small>НАГРАДА</small><b>1 200 XP</b></span></div>
            <div className="qf-arena-status"><span>{eventJoined ? "Место закреплено" : "Регистрация открыта"}</span><small>Сегодня · городской зачёт</small></div>
            <div className="qf-arena-actions">
              <button className="secondary" onClick={() => setArenaOpen(true)}><Route aria-hidden="true" /> Маршрут</button>
              <button className={eventJoined ? "joined" : ""} disabled={actionLoading === "event"} onClick={toggleEvent}><ShieldCheck aria-hidden="true" /> {eventJoined ? "Отменить участие" : "Участвовать"}</button>
            </div>
          </article>
        </section>

        <footer className="qf-footer"><span>QUESTFIT / SEASON 04</span><p>Твоя сила — твой статус.</p></footer>
      </main>

      <nav className="qf-mobile-nav" aria-label="Мобильная навигация">
        {navItems.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={activeSection === href.slice(1) ? "active" : ""} onClick={(event) => { event.preventDefault(); navigateTo(href); }}><Icon aria-hidden="true" /><span>{label}</span></a>)}
      </nav>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent className="qf-notification-sheet">
          <SheetHeader>
            <SheetTitle>Центр событий</SheetTitle>
            <SheetDescription>Всё важное по серии, команде и ближайшим стартам.</SheetDescription>
          </SheetHeader>
          <div className="qf-notification-list">
            <article className={!notificationsRead ? "unread" : ""}><Flame aria-hidden="true" /><div><b>Серия держится 12 дней</b><p>Закройте ещё два квеста до полуночи.</p><small>7 минут назад</small></div></article>
            <article><Users aria-hidden="true" /><div><b>Отряд прошёл ещё 6 км</b><p>До награды «Железного колосса» осталось 22 км.</p><small>42 минуты назад</small></div></article>
            <article><Trophy aria-hidden="true" /><div><b>Night Run уже близко</b><p>Старт сегодня в 19:30 на набережной.</p><small>2 часа назад</small></div></article>
          </div>
          <SheetFooter>
            <Button className="qf-sheet-action" onClick={() => { setNotificationsRead(true); toast.success("Все уведомления прочитаны"); }}>Прочитать всё</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="qf-info-dialog">
          <DialogHeader><DialogTitle>Профиль игрока</DialogTitle><DialogDescription>Ваши данные и текущая игровая форма.</DialogDescription></DialogHeader>
          <div className="qf-profile-card"><span className="qf-profile-avatar"><UserRound aria-hidden="true" /></span><div><b>{user?.fullName}</b><p>{user?.email}</p><small>{user?.goal}</small></div></div>
          <div className="qf-profile-stats"><span><b>24</b><small>уровень</small></span><span><b>{completed.length}</b><small>квеста сегодня</small></span><span><b>12</b><small>дней серии</small></span></div>
          <Button className="qf-sheet-action" onClick={() => { setProfileOpen(false); navigateTo("#quests"); }}>Перейти к квестам</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={arenaOpen} onOpenChange={setArenaOpen}>
        <DialogContent className="qf-info-dialog qf-arena-dialog">
          <DialogHeader><DialogTitle>Night Run: Урал</DialogTitle><DialogDescription>Городской ночной забег на 10 км. Старт сегодня в 19:30.</DialogDescription></DialogHeader>
          <div className="qf-arena-brief">
            <span><MapPin aria-hidden="true" /></span>
            <div><b>Набережная городского пруда</b><p>Сбор участников с 18:45 у главной сцены.</p></div>
            <strong>{eventJoined ? "ВЫ В ИГРЕ" : "286 ИГРОКОВ"}</strong>
          </div>
          <div className="qf-route-list">
            <div><span>1</span><p><b>Старт · 0 км</b><small>Главная сцена, разминка команды</small></p></div>
            <div><span>2</span><p><b>Чекпоинт · 5 км</b><small>Вода, фиксация времени и +300 XP</small></p></div>
            <div><span>3</span><p><b>Финиш · 10 км</b><small>Медаль сезона и 1 200 XP</small></p></div>
          </div>
          <div className="qf-arena-dialog-actions">
            <Button className="qf-sheet-action" disabled={actionLoading === "event"} onClick={toggleEvent}>{eventJoined ? "Отменить участие" : "Занять место"}</Button>
            {!user && <button onClick={() => { setArenaOpen(false); setAuthMode("register"); setAuthOpen(true); }}>Создать аккаунт и сохранить прогресс</button>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={squadOpen} onOpenChange={setSquadOpen}>
        <DialogContent className="qf-info-dialog qf-squad-dialog">
          <DialogHeader><DialogTitle>Отряд «Северный ветер»</DialogTitle><DialogDescription>Шесть игроков вместе проходят районный рейд.</DialogDescription></DialogHeader>
          <div className="qf-squad-boss-card"><span><Swords aria-hidden="true" /></span><div><small>ОБЩИЙ ПРОГРЕСС</small><b>{78 + squadBoost} / 100 км</b><Progress value={78 + squadBoost} className="qf-raid-progress" /></div></div>
          <div className="qf-member-list">
            <div><span>RV</span><p><b>Роман</b><small>18,4 км · лидер</small></p><strong>+640 XP</strong></div>
            <div><span>KM</span><p><b>Кира</b><small>15,2 км · темп</small></p><strong>+520 XP</strong></div>
            <div><span>AK</span><p><b>Алекс</b><small>12,8 км · поддержка</small></p><strong>+440 XP</strong></div>
          </div>
          <Button className="qf-sheet-action" disabled={squadBoost > 0} onClick={() => { setSquadBoost(2); toast.success("Вклад команды учтён", { description: "+2 км к рейду и +80 XP каждому участнику." }); }}>{squadBoost > 0 ? "Сегодняшний вклад учтён" : "Добавить командный бонус · +2 км"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={seasonOpen} onOpenChange={setSeasonOpen}>
        <DialogContent className="qf-info-dialog">
          <DialogHeader><DialogTitle>PRO-сезон 04</DialogTitle><DialogDescription>72% пути пройдено. Следующая награда — редкая рамка профиля.</DialogDescription></DialogHeader>
          <div className="qf-season-progress"><div><span>Ваш прогресс</span><b>7 240 / 10 000 XP</b></div><Progress value={72} className="qf-level-progress" /></div>
          <div className="qf-benefit-list"><p><Check aria-hidden="true" /> Двойной XP по выходным</p><p><Check aria-hidden="true" /> Закрытые командные рейды</p><p><Check aria-hidden="true" /> Три редкие награды сезона</p></div>
          <Button className="qf-sheet-action" onClick={() => { setProEnabled((value) => !value); setSeasonOpen(false); toast.success(proEnabled ? "PRO-режим выключен" : "PRO-режим включён"); }}>{proEnabled ? "Выключить PRO-режим" : "Включить PRO-режим"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="qf-info-dialog">
          <DialogHeader><DialogTitle>Помощь и поддержка</DialogTitle><DialogDescription>Ответим по аккаунту, прогрессу или участию в стартах.</DialogDescription></DialogHeader>
          <div className="qf-support-options"><button onClick={() => { void navigator.clipboard.writeText("support@questfit.app"); toast.success("Адрес поддержки скопирован"); }}><Mail aria-hidden="true" /><span><b>Скопировать почту</b><small>support@questfit.app</small></span></button><button onClick={() => { setSupportOpen(false); toast("Подсказка", { description: "Квест можно снять повторным нажатием на отметку." }); }}><HelpCircle aria-hidden="true" /><span><b>Как отменить квест?</b><small>Показать быструю подсказку</small></span></button></div>
          <a className="qf-mail-action" href="mailto:support@questfit.app?subject=QuestFit%20Support">Написать в поддержку</a>
        </DialogContent>
      </Dialog>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="qf-auth-dialog" onOpenAutoFocus={(event) => event.preventDefault()}>
          <div className="qf-auth-brand"><span className="qf-brand-mark"><Swords aria-hidden="true" /></span><b>QUESTFIT</b></div>
          <DialogHeader>
            <DialogTitle>Начни свою серию</DialogTitle>
            <DialogDescription>Один аккаунт для квестов, команды и прогресса.</DialogDescription>
          </DialogHeader>
          <Tabs value={authMode} onValueChange={(value) => { setAuthMode(value); setFormError(""); }}>
            <TabsList className="qf-auth-tabs">
              <TabsTrigger value="register">Регистрация</TabsTrigger>
              <TabsTrigger value="login">Вход</TabsTrigger>
            </TabsList>
            <TabsContent value="register">
              <AuthForm mode="register" submitting={submitting} error={formError} onSubmit={(event) => submitAuth(event, "register")} />
            </TabsContent>
            <TabsContent value="login">
              <AuthForm mode="login" submitting={submitting} error={formError} onSubmit={(event) => submitAuth(event, "login")} />
            </TabsContent>
          </Tabs>
          <p className="qf-terms">Продолжая, вы принимаете правила сервиса и политику конфиденциальности.</p>
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" richColors />
      <span className="sr-only" aria-live="polite">{sessionReady ? "Аккаунт проверен" : "Проверяем аккаунт"}</span>
    </div>
  );
}

function AuthForm({
  mode,
  submitting,
  error,
  onSubmit,
}: {
  mode: "register" | "login";
  submitting: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="qf-auth-form" onSubmit={onSubmit}>
      {mode === "register" && (
        <div className="qf-field">
          <Label htmlFor="fullName">Имя</Label>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="Как к вам обращаться" minLength={2} maxLength={60} required />
        </div>
      )}
      <div className="qf-field">
        <Label htmlFor={`${mode}-email`}>Электронная почта</Label>
        <Input id={`${mode}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </div>
      <div className="qf-field">
        <Label htmlFor={`${mode}-password`}>Пароль</Label>
        <Input id={`${mode}-password`} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Минимум 8 символов" minLength={8} maxLength={128} required />
      </div>
      {error && <p className="qf-auth-error" role="alert">{error}</p>}
      <Button type="submit" className="qf-auth-submit" disabled={submitting}>
        {submitting ? "Подождите…" : mode === "register" ? "Создать аккаунт" : "Войти"}
      </Button>
    </form>
  );
}
