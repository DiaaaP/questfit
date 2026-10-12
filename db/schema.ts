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
