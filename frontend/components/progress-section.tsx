"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Footprints,
  Medal,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
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
import type { DashboardData, NewWorkoutInput, WorkoutType } from "@/shared/questfit";
import { workoutTypeLabels } from "@/shared/questfit";

const workoutIcons = {
  strength: Dumbbell,
  run: Activity,
  walk: Footprints,
  cycling: Bike,
  mobility: Sparkles,
} satisfies Record<WorkoutType, typeof Activity>;

type ProgressSectionProps = {
  dashboard: DashboardData;
  onCreateWorkout: (workout: NewWorkoutInput) => Promise<void>;
  onDeleteWorkout: (workoutId: number) => Promise<void>;
};

export function ProgressSection({ dashboard, onCreateWorkout, onDeleteWorkout }: ProgressSectionProps) {
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const goalProgress = Math.min(100, Math.round((dashboard.totals.minutes / dashboard.preferences.weeklyGoalMinutes) * 100));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function submitWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const performedAt = new Date(`${String(form.get("date"))}T12:00:00`).getTime();
    const workout: NewWorkoutInput = {
      title: String(form.get("title") ?? "").trim(),
      type: String(form.get("type") ?? "strength") as WorkoutType,
      durationMinutes: Number(form.get("durationMinutes")),
      distanceKm: Number(form.get("distanceKm")),
      calories: Number(form.get("calories")),
      performedAt,
      notes: String(form.get("notes") ?? "").trim(),
    };

    try {
      if (workout.title.length < 2 || workout.durationMinutes < 5 || Number.isNaN(performedAt)) {
        throw new Error("Заполните название, дату и длительность тренировки.");
      }
      await onCreateWorkout(workout);
      setWorkoutOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось добавить тренировку.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="qf-section qf-progress-section" id="progress">
      <div className="qf-section-head qf-progress-head">
        <div><span className="qf-kicker">PROGRESS LAB</span><h2>История и аналитика</h2></div>
        <Button className="qf-add-workout" onClick={() => setWorkoutOpen(true)}><Plus aria-hidden="true" /> Записать тренировку</Button>
      </div>

      <div className="qf-metric-grid">
        <article><Timer aria-hidden="true" /><span><small>Время</small><b>{dashboard.totals.minutes} мин</b></span></article>
        <article><Activity aria-hidden="true" /><span><small>Дистанция</small><b>{dashboard.totals.distanceKm.toLocaleString("ru-RU")} км</b></span></article>
        <article><Flame aria-hidden="true" /><span><small>Энергия</small><b>{dashboard.totals.calories.toLocaleString("ru-RU")} ккал</b></span></article>
        <article><Sparkles aria-hidden="true" /><span><small>Опыт тренировок</small><b>+{dashboard.totals.workoutXp.toLocaleString("ru-RU")} XP</b></span></article>
      </div>

      <div className="qf-progress-layout">
        <article className="qf-panel qf-history-panel">
          <div className="qf-panel-head">
            <div><span className="qf-kicker">ACTIVITY LOG</span><h2>Последние тренировки</h2></div>
            <span className="qf-history-count">{dashboard.workouts.length} записей</span>
          </div>
          <div className="qf-goal-card">
            <div><span>Недельная цель</span><b>{dashboard.totals.minutes} / {dashboard.preferences.weeklyGoalMinutes} мин</b></div>
            <Progress value={goalProgress} className="qf-level-progress" aria-label={`Недельная цель выполнена на ${goalProgress}%`} />
          </div>
          <div className="qf-workout-list">
            {dashboard.workouts.length === 0 ? (
              <div className="qf-empty-workouts"><Activity aria-hidden="true" /><p>История пока пуста.<br /><span>Добавьте первую тренировку.</span></p></div>
            ) : dashboard.workouts.slice(0, 6).map((workout) => {
              const Icon = workoutIcons[workout.type];
              return (
                <div className="qf-workout-row" key={workout.id}>
                  <span className={`qf-workout-type ${workout.type}`}><Icon aria-hidden="true" /></span>
                  <div><b>{workout.title}</b><small>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(workout.performedAt)} · {workoutTypeLabels[workout.type]}</small></div>
                  <p><b>{workout.durationMinutes} мин</b><small>{workout.distanceKm > 0 ? `${workout.distanceKm.toLocaleString("ru-RU")} км · ` : ""}+{workout.xp} XP</small></p>
                  <button onClick={() => void onDeleteWorkout(workout.id)} aria-label={`Удалить тренировку ${workout.title}`}><Trash2 aria-hidden="true" /></button>
                </div>
              );
            })}
          </div>
        </article>

        <div className="qf-progress-side">
          <article className="qf-panel qf-leaderboard-panel">
            <div className="qf-panel-head"><div><span className="qf-kicker">CITY LEAGUE</span><h2>Рейтинг города</h2></div><Trophy aria-hidden="true" /></div>
            <div className="qf-leaderboard-list">
              {dashboard.leaderboard.map((entry) => (
                <div className={entry.currentUser ? "current" : ""} key={`${entry.position}-${entry.name}`}>
                  <strong>{entry.position}</strong><span>{entry.accent}</span><p><b>{entry.name}</b><small>{entry.xp.toLocaleString("ru-RU")} XP</small></p>
                </div>
              ))}
            </div>
          </article>

          <article className="qf-panel qf-achievement-panel">
            <div className="qf-panel-head"><div><span className="qf-kicker">BADGES</span><h2>Достижения</h2></div><Medal aria-hidden="true" /></div>
            <div className="qf-achievement-list">
              {dashboard.achievements.map((achievement) => (
                <div className={achievement.unlocked ? "unlocked" : ""} key={achievement.slug}>
                  <span><Medal aria-hidden="true" /></span>
                  <p><b>{achievement.title}</b><small>{achievement.description}</small></p>
                  <strong>{achievement.unlocked ? "ГОТОВО" : `${achievement.progress}%`}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <Dialog open={workoutOpen} onOpenChange={setWorkoutOpen}>
        <DialogContent className="qf-info-dialog qf-workout-dialog">
          <DialogHeader><DialogTitle>Записать тренировку</DialogTitle><DialogDescription>Результат попадёт в историю, аналитику и рейтинг.</DialogDescription></DialogHeader>
          <form className="qf-workout-form" onSubmit={submitWorkout}>
            <div className="qf-field"><Label htmlFor="workout-title">Название</Label><Input id="workout-title" name="title" placeholder="Например, лёгкий бег" minLength={2} maxLength={80} required /></div>
            <div className="qf-form-pair">
              <div className="qf-field"><Label htmlFor="workout-type">Тип</Label><select id="workout-type" name="type" defaultValue="run">{Object.entries(workoutTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="qf-field"><Label htmlFor="workout-date">Дата</Label><Input id="workout-date" name="date" type="date" defaultValue={today} max={today} required /></div>
            </div>
            <div className="qf-form-triple">
              <div className="qf-field"><Label htmlFor="workout-duration">Минуты</Label><Input id="workout-duration" name="durationMinutes" type="number" min={5} max={600} defaultValue={45} required /></div>
              <div className="qf-field"><Label htmlFor="workout-distance">Километры</Label><Input id="workout-distance" name="distanceKm" type="number" min={0} max={300} step="0.1" defaultValue={0} required /></div>
              <div className="qf-field"><Label htmlFor="workout-calories">Ккал</Label><Input id="workout-calories" name="calories" type="number" min={0} max={10000} defaultValue={300} required /></div>
            </div>
            <div className="qf-field"><Label htmlFor="workout-notes">Комментарий</Label><textarea id="workout-notes" name="notes" maxLength={300} placeholder="Самочувствие, темп или результаты" /></div>
            {formError && <p className="qf-auth-error" role="alert">{formError}</p>}
            <Button type="submit" className="qf-sheet-action" disabled={submitting}>{submitting ? "Сохраняем…" : "Добавить тренировку"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
