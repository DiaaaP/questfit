import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    goal: text("goal").notNull().default("Баланс и выносливость"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_users_email").on(table.email)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

export const questProgress = sqliteTable(
  "quest_progress",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: integer("quest_id").notNull(),
    completedAt: integer("completed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.questId] })],
);

export const eventRegistrations = sqliteTable(
  "event_registrations",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug").notNull(),
    registeredAt: integer("registered_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.eventSlug] })],
);

export const dailyQuestCompletions = sqliteTable(
  "daily_quest_completions",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questId: integer("quest_id").notNull(),
    day: text("day").notNull(),
    xp: integer("xp").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day, table.questId] })],
);

export const eventFinishes = sqliteTable(
  "event_finishes",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventSlug: text("event_slug").notNull(),
    xp: integer("xp").notNull(),
    finishedAt: integer("finished_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.eventSlug] })],
);

export const workoutLogs = sqliteTable(
  "workout_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    activityType: text("activity_type").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    distanceMeters: integer("distance_meters").notNull().default(0),
    calories: integer("calories").notNull().default(0),
    xp: integer("xp").notNull(),
    performedAt: integer("performed_at").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_workout_logs_user_id").on(table.userId),
    index("idx_workout_logs_performed_at").on(table.performedAt),
  ],
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(300),
  city: text("city").notNull().default("Екатеринбург"),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull(),
});

export const teams = sqliteTable(
  "teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull(),
    goalKm: integer("goal_km").notNull().default(100),
    leaderUserId: integer("leader_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_teams_invite_code").on(table.inviteCode)],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: integer("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    uniqueIndex("idx_team_members_user_id").on(table.userId),
  ],
);

export const teamContributions = sqliteTable(
  "team_contributions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    distanceMeters: integer("distance_meters").notNull(),
    xp: integer("xp").notNull(),
    contributedAt: integer("contributed_at").notNull(),
  },
  (table) => [
    index("idx_team_contributions_team_id").on(table.teamId),
    index("idx_team_contributions_user_id").on(table.userId),
  ],
);

export const questDefinitions = sqliteTable("quest_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  xp: integer("xp").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull(),
    distanceMeters: integer("distance_meters").notNull(),
    startAt: integer("start_at").notNull(),
    rewardXp: integer("reward_xp").notNull(),
    capacity: integer("capacity").notNull().default(100),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_events_slug").on(table.slug)],
);
