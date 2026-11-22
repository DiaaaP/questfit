export const workoutTypeLabels = {
    strength: "Силовая",
    run: "Бег",
    walk: "Ходьба",
    cycling: "Велосипед",
    mobility: "Мобильность",
};
export const defaultPreferences = {
    weeklyGoalMinutes: 150,
    city: "Алматы",
    notificationsEnabled: true,
};
const demoWorkouts = [
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
export function calculateWorkoutXp(input) {
    return Math.min(1000, Math.round(input.durationMinutes * 4 + input.distanceKm * 20));
}
export function buildDashboard(workouts = demoWorkouts, preferences = defaultPreferences, currentName = "Атлет") {
    const totals = workouts.reduce((result, workout) => ({
        minutes: result.minutes + workout.durationMinutes,
        distanceKm: result.distanceKm + workout.distanceKm,
        calories: result.calories + workout.calories,
        workoutXp: result.workoutXp + workout.xp,
    }), { minutes: 0, distanceKm: 0, calories: 0, workoutXp: 0 });
    const achievements = [
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
        {
            slug: "active-hour",
            title: "Час в движении",
            description: "Записать суммарно 60 минут активности",
            unlocked: totals.minutes >= 60,
            progress: Math.min(100, Math.round(totals.minutes / 60 * 100)),
        },
        {
            slug: "all-rounder",
            title: "Разносторонний атлет",
            description: "Попробовать три разных вида активности",
            unlocked: new Set(workouts.map((workout) => workout.type)).size >= 3,
            progress: Math.min(100, Math.round(new Set(workouts.map((workout) => workout.type)).size / 3 * 100)),
        },
        {
            slug: "thousand-xp",
            title: "Первая тысяча",
            description: "Заработать 1 000 XP за тренировки",
            unlocked: totals.workoutXp >= 1000,
            progress: Math.min(100, Math.round(totals.workoutXp / 10)),
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
