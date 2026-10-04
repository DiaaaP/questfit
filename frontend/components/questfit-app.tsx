"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  LayoutDashboard,
  LogOut,
  MapPin,
  Medal,
  Menu,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type User = {
  id: number;
  fullName: string;
  email: string;
  goal: string;
};

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

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then(async (response) => (await response.json()) as { user?: User | null })
      .then((data) => {
        if (!active) return;
        setUser(data.user ?? null);
        setSessionReady(true);
        if (!data.user) window.setTimeout(() => active && setAuthOpen(true), 350);
      })
      .catch(() => {
        if (!active) return;
        setSessionReady(true);
        setAuthOpen(true);
      });
    return () => {
      active = false;
    };
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
          execute(input: unknown) {
            const questId = Number((input as { questId?: unknown })?.questId);
            const quest = quests.find((item) => item.id === questId);
            if (!quest || !Number.isInteger(questId)) throw new Error("Неизвестный квест.");
            setCompleted((current) => (current.includes(questId) ? current : [...current, questId]));
            return { questId, title: quest.title, status: "completed", xp: quest.xp };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

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

  function toggleQuest(id: number, title: string) {
    setCompleted((current) => {
      if (current.includes(id)) return current.filter((questId) => questId !== id);
      toast.success(`Квест «${title}» закрыт`, { description: "Опыт уже добавлен к уровню." });
      return [...current, id];
    });
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
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
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
          {navItems.map(({ href, label, icon: Icon }, index) => (
            <a key={href} href={href} className={index === 0 ? "active" : ""} onClick={() => setMobileOpen(false)}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="qf-sidebar-spacer" />
        <div className="qf-sidebar-card">
          <Sparkles aria-hidden="true" />
          <strong>PRO-сезон 04</strong>
          <span>В топ-12% игроков</span>
          <Progress value={72} className="qf-mini-progress" aria-label="Прогресс сезона: 72%" />
        </div>
        <a className="qf-support-link" href="mailto:support@questfit.app">Помощь и поддержка</a>
      </aside>

      {mobileOpen && <button className="qf-scrim" onClick={() => setMobileOpen(false)} aria-label="Закрыть меню" />}

      <main className="qf-main" id="overview">
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
            <button className="qf-icon-button" aria-label="Уведомления"><Bell aria-hidden="true" /><i /></button>
            {user ? (
              <div className="qf-account">
                <span className="qf-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
                <span><b>{firstName}</b><small>ур. 24</small></span>
                <button onClick={logout} aria-label="Выйти"><LogOut aria-hidden="true" /></button>
              </div>
            ) : (
              <Button className="qf-register-button" onClick={() => { setAuthMode("register"); setAuthOpen(true); }}>
                <UserPlus aria-hidden="true" /> Регистрация
              </Button>
            )}
          </div>
        </header>

        <section className="qf-hero-grid" aria-label="Прогресс за сегодня">
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
                  <button onClick={() => toggleQuest(quest.id, quest.title)} aria-label={done ? `Вернуть квест ${quest.title}` : `Завершить квест ${quest.title}`}>
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
            <div className="qf-boss"><span><Swords aria-hidden="true" /></span><div><small>РАЙОННЫЙ БОСС</small><h2>Железный колосс</h2><p>78 / 100 км командой</p></div></div>
            <Progress value={78} className="qf-raid-progress" aria-label="Прогресс командного рейда: 78%" />
            <div className="qf-squad-row">
              <div className="qf-avatar-stack"><span>RV</span><span>KM</span><span>AK</span><span>+3</span></div>
              <b>До награды 22 км</b>
            </div>
          </article>

          <article className="qf-panel qf-arena-panel" id="arena">
            <div className="qf-panel-head"><div><span className="qf-kicker">ARENA</span><h2>Ближайший старт</h2></div><Trophy aria-hidden="true" /></div>
            <h3>Night Run: Урал</h3>
            <p><MapPin aria-hidden="true" /> Набережная · 10 км</p>
            <div className="qf-arena-meta"><span><small>СТАРТ</small><b>19:30</b></span><span><small>ИГРОКОВ</small><b>286</b></span><span><small>НАГРАДА</small><b>1 200 XP</b></span></div>
            <button onClick={() => toast.success("Вы в списке участников", { description: "Напомним за два часа до старта." })}><ShieldCheck aria-hidden="true" /> Записаться</button>
          </article>
        </section>

        <footer className="qf-footer"><span>QUESTFIT / SEASON 04</span><p>Твоя сила — твой статус.</p></footer>
      </main>

      <nav className="qf-mobile-nav" aria-label="Мобильная навигация">
        {navItems.map(({ href, label, icon: Icon }) => <a key={href} href={href}><Icon aria-hidden="true" /><span>{label}</span></a>)}
      </nav>

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
