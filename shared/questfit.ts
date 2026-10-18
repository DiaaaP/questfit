export type WorkoutType = "strength" | "run" | "walk" | "cycling" | "mobility";

export type WorkoutEntry = {
  id: number;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  distanceKm: number;
  calories: number;
  xp: number;
  performedAt: number;
  notes: string;
};

export type ProfilePreferences = {
  weeklyGoalMinutes: number;
  city: string;
  notificationsEnabled: boolean;
};

export type Achievement = {
  slug: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
};

export type LeaderboardEntry = {
  position: number;
  name: string;
  xp: number;
  accent: string;
  currentUser?: boolean;
};

export type DashboardData = {
  workouts: WorkoutEntry[];
  preferences: ProfilePreferences;
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
  totals: {
    minutes: number;
    distanceKm: number;
    calories: number;
    workoutXp: number;
  };
};

export type NewWorkoutInput = Omit<WorkoutEntry, "id" | "xp">;

export type TeamMember = {
  userId: number;
  name: string;
  role: "leader" | "member";
  contributionKm: number;
  xp: number;
  joinedAt: number;
};

export type TeamData = {
  id: number;
  name: string;
  code: string;
  goalKm: number;
  totalKm: number;
  leaderId: number;
  members: TeamMember[];
};

export type AdminUser = {
  id: number;
  fullName: string;
  email: string;
  goal: string;
  createdAt: number;
  workoutCount: number;
  teamName: string | null;
};

export type AdminQuest = {
  id: number;
  title: string;
  detail: string;
  xp: number;
  active: boolean;
};

export type AdminEvent = {
  id: number;
  slug: string;
  title: string;
  location: string;
  distanceKm: number;
  startAt: number;
  rewardXp: number;
  capacity: number;
  active: boolean;
  registrations: number;
};

export type AdminData = {
  users: AdminUser[];
  quests: AdminQuest[];
  events: AdminEvent[];
};

export const workoutTypeLabels: Record<WorkoutType, string> = {
  strength: "Силовая",
  run: "Бег",
  walk: "Ходьба",
  cycling: "Велосипед",
  mobility: "Мобильность",
};

export const defaultPreferences: ProfilePreferences = {
  weeklyGoalMinutes: 300,
  city: "Екатеринбург",
  notificationsEnabled: true,
};

const demoWorkouts: WorkoutEntry[] = [
  {
    id: 101,
    title: "Темповый бег",
    type: "run",
    durationMinutes: 48,
    distanceKm: 7.2,
    calories: 510,
    xp: 336,
    performedAt: Date.now() - 1000 * 60 * 60 * 20,
    notes: "Ровный темп, последние 2 км быстрее.",
  },
  {
    id: 102,
    title: "Верх тела",
    type: "strength",
    durationMinutes: 55,
    distanceKm: 0,
    calories: 390,
    xp: 275,
    performedAt: Date.now() - 1000 * 60 * 60 * 47,
    notes: "Жим, подтягивания и плечи.",
  },
  {
    id: 103,
    title: "Восстановительная прогулка",
    type: "walk",
    durationMinutes: 62,
    distanceKm: 5.1,
    calories: 260,
    xp: 164,
    performedAt: Date.now() - 1000 * 60 * 60 * 73,
    notes: "Спокойная нагрузка после силовой.",
  },
];

export function calculateWorkoutXp(input: Pick<NewWorkoutInput, "durationMinutes" | "distanceKm">) {
  return Math.min(1000, Math.round(input.durationMinutes * 4 + input.distanceKm * 20));
}

export function buildDashboard(
  workouts: WorkoutEntry[] = demoWorkouts,
  preferences: ProfilePreferences = defaultPreferences,
  currentName = "Атлет",
): DashboardData {
  const totals = workouts.reduce(
    (result, workout) => ({
      minutes: result.minutes + workout.durationMinutes,
      distanceKm: result.distanceKm + workout.distanceKm,
      calories: result.calories + workout.calories,
      workoutXp: result.workoutXp + workout.xp,
    }),
    { minutes: 0, distanceKm: 0, calories: 0, workoutXp: 0 },
  );

  const achievements: Achievement[] = [
    {
      slug: "first-workout",
      title: "Первый шаг",
      description: "Записать первую тренировку",
      unlocked: workouts.length >= 1,
      progress: Math.min(100, workouts.length * 100),
    },
    {
      slug: "five-workouts",
      title: "Ритм найден",
      description: "Записать 5 тренировок",
      unlocked: workouts.length >= 5,
      progress: Math.min(100, Math.round((workouts.length / 5) * 100)),
    },
    {
      slug: "ten-km",
      title: "Исследователь",
      description: "Преодолеть 10 км",
      unlocked: totals.distanceKm >= 10,
      progress: Math.min(100, Math.round((totals.distanceKm / 10) * 100)),
    },
  ];

  return {
    workouts: [...workouts].sort((a, b) => b.performedAt - a.performedAt),
    preferences,
    achievements,
    leaderboard: [
      { position: 1, name: "Макс Ветров", xp: 8940, accent: "MV" },
      { position: 2, name: "Кира Мороз", xp: 8260, accent: "KM" },
      { position: 3, name: currentName, xp: 6980 + totals.workoutXp, accent: currentName.slice(0, 2).toUpperCase(), currentUser: true },
      { position: 4, name: "Роман Волков", xp: 6840, accent: "RV" },
      { position: 5, name: "Алекс Ким", xp: 6310, accent: "AK" },
    ],
    totals: {
      ...totals,
      distanceKm: Math.round(totals.distanceKm * 10) / 10,
    },
  };
}
