import json
from datetime import datetime, timedelta, timezone
from math import floor
from secrets import choice

from fastapi import HTTPException

from .database import ROOT, now_ms

SEED = json.loads((ROOT / "web/catalog.json").read_text(encoding="utf-8"))
DEFAULT_EVENT = SEED["events"][0]
GOAL = "Баланс и выносливость"
PREFERENCES = {"weeklyGoalMinutes": 150, "city": "Алматы", "notificationsEnabled": True}
ALMATY = timezone(timedelta(hours=5))
DAY_MS = 86_400_000


def rounded(value):
    return floor(value + 0.5)


def quest_period(timestamp):
    local = datetime.fromtimestamp(timestamp / 1000, ALMATY)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start.date().isoformat(), int(start.timestamp() * 1000)


def workouts(db, user_id):
    return [dict(row) for row in db.execute("""
        SELECT id, title, activity_type AS type, duration_minutes AS durationMinutes, calories, xp,
               distance_meters / 1000.0 AS distanceKm, performed_at AS performedAt, notes
        FROM workout_logs WHERE user_id = ? ORDER BY performed_at DESC, id DESC
    """, (user_id,))]


def preferences(db, user_id):
    row = db.execute("""
        SELECT weekly_goal_minutes AS weeklyGoalMinutes, city, notifications_enabled AS notificationsEnabled
        FROM user_preferences WHERE user_id = ?
    """, (user_id,)).fetchone()
    return {**dict(row), "notificationsEnabled": bool(row["notificationsEnabled"])} if row else PREFERENCES.copy()


def dashboard(db, user_id):
    history = workouts(db, user_id)
    minutes = sum(entry["durationMinutes"] for entry in history)
    distance = sum(entry["distanceKm"] for entry in history)
    xp = sum(entry["xp"] for entry in history)
    kinds = len({entry["type"] for entry in history})
    targets = [
        ("first-workout", "Первый шаг", "Записать первую тренировку", len(history), 1),
        ("five-workouts", "Ритм найден", "Записать 5 тренировок", len(history), 5),
        ("ten-km", "Исследователь", "Преодолеть 10 км", distance, 10),
        ("active-hour", "Час в движении", "Записать суммарно 60 минут активности", minutes, 60),
        ("all-rounder", "Разносторонний атлет", "Попробовать три разных вида активности", kinds, 3),
        ("thousand-xp", "Первая тысяча", "Заработать 1 000 XP за тренировки", xp, 1000),
    ]
    prefs = preferences(db, user_id)
    leaders = db.execute("""
        SELECT u.id, u.full_name, COALESCE(SUM(w.xp), 0) AS xp
        FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
        LEFT JOIN workout_logs w ON w.user_id = u.id
        WHERE COALESCE(p.city, ?) = ? COLLATE QF_CASEFOLD
        GROUP BY u.id ORDER BY xp DESC, u.id LIMIT 20
    """, (PREFERENCES["city"], prefs["city"]))
    leaderboard = []
    for position, row in enumerate(leaders, 1):
        name = row["full_name"].split()
        leaderboard.append({
            "position": position, "name": f"{name[0]} {name[1][0]}." if len(name) > 1 else name[0],
            "xp": row["xp"], "accent": row["full_name"][:2].upper(), "currentUser": row["id"] == user_id,
        })
    return {
        "workouts": history, "preferences": prefs, "leaderboard": leaderboard,
        "totals": {"minutes": minutes, "distanceKm": rounded(distance * 10) / 10,
                   "calories": sum(entry["calories"] for entry in history), "workoutXp": xp},
        "achievements": [
            {"slug": slug, "title": title, "description": description, "unlocked": value >= target,
             "progress": min(100, rounded(100 * value / target))}
            for slug, title, description, value, target in targets
        ],
    }


def quests(db):
    return [{**dict(q), "active": bool(q["active"])} for q in db.execute(
        "SELECT id, title, detail, xp, active FROM quest_definitions ORDER BY id"
    )]


def events(db):
    result = [{**dict(event), "active": bool(event["active"])} for event in db.execute("""
        SELECT e.id, e.slug, e.title, e.location, e.distance_meters / 1000.0 AS distanceKm,
               e.start_at AS startAt, e.reward_xp AS rewardXp, e.capacity, e.active,
               (SELECT COUNT(*) FROM event_registrations r WHERE r.event_slug = e.slug) AS registrations
        FROM events e ORDER BY e.start_at, e.id
    """)]
    slug = DEFAULT_EVENT["slug"]
    if all(event["slug"] != slug for event in result) and not db.execute(
        "SELECT 1 FROM hidden_default_events WHERE slug = ?", (slug,)
    ).fetchone():
        count = db.execute("SELECT COUNT(*) FROM event_registrations WHERE event_slug = ?", (slug,)).fetchone()[0]
        result.append({**DEFAULT_EVENT, "registrations": count})
        result.sort(key=lambda event: event["startAt"])
    return result


def registrations(db, user_id):
    if user_id is None:
        return []
    return [row[0] for row in db.execute(
        "SELECT event_slug FROM event_registrations WHERE user_id = ? ORDER BY registered_at", (user_id,)
    )]


def catalog(db, user_id):
    joined = set(registrations(db, user_id))
    return {
        "quests": SEED["quests"] + [
            {**q, "id": q["id"] + 1000, "category": "custom"} for q in quests(db) if q["active"]
        ],
        "events": [event for event in events(db) if event["active"] or event["slug"] in joined],
    }


def activity(db, user_id, now):
    day, _ = quest_period(now)
    progress = {(row["day"], row["quest_id"]): row["xp"] for row in db.execute(
        "SELECT day, quest_id, xp FROM daily_quest_completions WHERE user_id = ?", (user_id,)
    )}
    lookup = {q["id"]: q["xp"] for q in SEED["quests"]}
    lookup.update({q["id"] + 1000: q["xp"] for q in quests(db)})
    for record in db.execute("SELECT quest_id, completed_at FROM quest_progress WHERE user_id = ?", (user_id,)):
        legacy_day, _ = quest_period(record["completed_at"])
        progress.setdefault((legacy_day, record["quest_id"]), lookup.get(record["quest_id"], 0))
    available = {event["slug"] for event in events(db)}
    joined = [slug for slug in registrations(db, user_id) if slug in available]
    finished = [dict(row) for row in db.execute("""
        SELECT event_slug AS slug, xp, finished_at AS finishedAt FROM event_finishes WHERE user_id = ?
    """, (user_id,))]
    today = {quest: xp for (completed_day, quest), xp in progress.items() if completed_day == day}
    return {
        "questDay": day, "completedQuestIds": sorted(today), "todayQuestXp": sum(today.values()),
        "questXp": sum(progress.values()), "eventXp": sum(finish["xp"] for finish in finished),
        "registeredEventSlugs": joined, "registeredForEvent": DEFAULT_EVENT["slug"] in joined,
        "finishedEvents": finished,
    }


def update_quest_progress(db, user_id, quest_id, completed, now):
    day, start = quest_period(now)
    if completed:
        quest = next((entry for entry in catalog(db, user_id)["quests"] if entry["id"] == quest_id), None)
        if quest is None:
            raise HTTPException(404, "Этот квест сейчас недоступен.")
        db.execute("""
            INSERT OR IGNORE INTO daily_quest_completions (user_id, quest_id, day, xp)
            SELECT ?, ?, ?, ? WHERE NOT EXISTS (
                 SELECT 1 FROM quest_progress WHERE user_id = ? AND quest_id = ? AND completed_at >= ? AND completed_at < ?
            )
        """, (user_id, quest_id, day, quest["xp"], user_id, quest_id, start, start + DAY_MS))
    else:
        db.execute("DELETE FROM daily_quest_completions WHERE user_id = ? AND quest_id = ? AND day = ?",
                   (user_id, quest_id, day))
        db.execute("DELETE FROM quest_progress WHERE user_id = ? AND quest_id = ? AND completed_at >= ? AND completed_at < ?",
                   (user_id, quest_id, start, start + DAY_MS))


def update_event_progress(db, user_id, slug, action, now, registered=False):
    joined = slug in registrations(db, user_id)
    finished = db.execute("SELECT 1 FROM event_finishes WHERE user_id = ? AND event_slug = ?", (user_id, slug)).fetchone()
    if action == "event" and not registered:
        if finished:
            raise HTTPException(409, "Запись с подтверждённым финишем отменить нельзя.")
        db.execute("DELETE FROM event_registrations WHERE user_id = ? AND event_slug = ?", (user_id, slug))
        return
    event = next((entry for entry in events(db) if entry["slug"] == slug), None)
    if action == "finishEvent":
        if finished:
            return
        if not joined or not event or event["startAt"] > now:
            raise HTTPException(409, "Отметить финиш можно после начала старта, на который вы записаны.")
        db.execute("INSERT INTO event_finishes (user_id, event_slug, xp, finished_at) VALUES (?, ?, ?, ?)",
                   (user_id, slug, event["rewardXp"], now))
    elif not joined:
        if not event or not event["active"] or event["startAt"] <= now or event["registrations"] >= event["capacity"]:
            raise HTTPException(409, "Запись закрыта или свободных мест больше нет.")
        db.execute("INSERT INTO event_registrations (user_id, event_slug, registered_at) VALUES (?, ?, ?)", (user_id, slug, now))


def team_state(db, user_id):
    team = db.execute("""
        SELECT t.id, t.name, t.invite_code AS code, t.goal_km AS goalKm, t.leader_user_id AS leaderId
        FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.user_id = ?
    """, (user_id,)).fetchone()
    if not team:
        return None
    members = [dict(row) for row in db.execute("""
        SELECT u.id AS userId, u.full_name AS name, m.role, m.joined_at AS joinedAt,
               ROUND(COALESCE(SUM(c.distance_meters), 0) / 1000.0, 1) AS contributionKm,
               COALESCE(SUM(c.xp), 0) AS xp
        FROM team_members m JOIN users u ON u.id = m.user_id
        LEFT JOIN team_contributions c ON c.team_id = m.team_id AND c.user_id = m.user_id
        WHERE m.team_id = ? GROUP BY u.id
        ORDER BY m.role = 'leader' DESC, contributionKm DESC, m.joined_at, u.id
    """, (team["id"],))]
    return {**dict(team), "members": members, "totalKm": rounded(sum(m["contributionKm"] for m in members) * 10) / 10}


def set_leader(db, team_id, successor):
    db.execute("UPDATE teams SET leader_user_id = ? WHERE id = ?", (successor, team_id))
    db.execute("UPDATE team_members SET role = CASE WHEN user_id = ? THEN 'leader' ELSE 'member' END WHERE team_id = ?",
               (successor, team_id))


def change_team(db, user_id, command):
    team = team_state(db, user_id)
    now = now_ms()
    action = command.action
    if action in {"create", "join"}:
        if team:
            raise HTTPException(409, "Сначала выйдите из текущей команды.")
        if action == "create":
            alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            while True:
                code = "".join(choice(alphabet) for _ in range(6))
                if not db.execute("SELECT 1 FROM teams WHERE invite_code = ?", (code,)).fetchone():
                    break
            role = "leader"
            team_id = db.execute("INSERT INTO teams (name, invite_code, goal_km, leader_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
                                 (command.name, code, command.goalKm, user_id, now)).lastrowid
        else:
            target = db.execute("SELECT id FROM teams WHERE invite_code = ?", (command.code.upper(),)).fetchone()
            if not target:
                raise HTTPException(404, "Команда с таким кодом не найдена.")
            role, team_id = "member", target["id"]
        db.execute("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)", (team_id, user_id, role, now))
    else:
        if not team:
            raise HTTPException(404, "Сначала вступите в команду.")
        team_id = team["id"]
        others = [member["userId"] for member in team["members"] if member["userId"] != user_id]
        leader = team["leaderId"] == user_id
        if action == "contribute":
            meters = rounded(command.distanceKm * 1000)
            if not meters:
                raise HTTPException(400, "Минимальная дистанция — 1 метр.")
            db.execute("INSERT INTO team_contributions (team_id, user_id, distance_meters, xp, contributed_at) VALUES (?, ?, ?, ?, ?)",
                       (team_id, user_id, meters, rounded(command.distanceKm * 40), now))
        elif action == "leave":
            if leader and not others:
                db.execute("DELETE FROM teams WHERE id = ?", (team_id,))
            else:
                if leader:
                    set_leader(db, team_id, others[0])
                db.execute("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", (team_id, user_id))
        else:
            if not leader:
                raise HTTPException(403, "Это действие доступно лидеру команды.")
            if command.userId not in others:
                raise HTTPException(404, "Выберите другого участника команды.")
            if action == "transfer":
                set_leader(db, team_id, command.userId)
            else:
                db.execute("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", (team_id, command.userId))
    return team_state(db, user_id)
