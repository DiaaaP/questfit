import base64
import hashlib
import hmac
import re
import secrets
import sqlite3
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from .database import ROOT, atomic, connect, database_path, initialize, now_ms
from .domain import (
    DEFAULT_EVENT, GOAL, PREFERENCES, activity, catalog, change_team, dashboard, events, preferences, quests,
    rounded, team_state, update_event_progress, update_quest_progress, workouts,
)

WEB = ROOT / "web"
SESSION_KEY = "qf_session"
SESSION_SECONDS = 30 * 86_400
Slug = Annotated[str, Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")]
PositiveId = Annotated[int, Field(ge=1, le=2**53 - 1)]
EventId = Annotated[int, Field(ge=-1, le=2**53 - 1)]


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)


class Login(Input):
    model_config = ConfigDict(str_strip_whitespace=False)
    email: str = Field(max_length=160)
    password: str = Field(max_length=128)


class Register(Login):
    fullName: str = Field(min_length=2, max_length=60)
    goal: str = Field(default=GOAL, max_length=80)


class Workout(Input):
    title: str = Field(min_length=2, max_length=80)
    type: Literal["strength", "run", "walk", "cycling", "mobility"]
    durationMinutes: int = Field(ge=5, le=600)
    distanceKm: float = Field(ge=0, le=300)
    calories: int = Field(ge=0, le=10_000)
    performedAt: int = Field(gt=0, le=253402300799000)
    notes: str = Field(default="", max_length=300)


class Profile(Input):
    fullName: str = Field(min_length=2, max_length=60)
    goal: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    weeklyGoalMinutes: int = Field(ge=60, le=2000)
    notificationsEnabled: StrictBool


class QuestProgress(Input):
    action: Literal["quest"]
    questId: PositiveId
    completed: StrictBool


class EventRegistration(Input):
    action: Literal["event"]
    eventSlug: Slug = DEFAULT_EVENT["slug"]
    registered: StrictBool


class FinishEvent(Input):
    action: Literal["finishEvent"]
    eventSlug: Slug


class CreateTeam(Input):
    action: Literal["create"]
    name: str = Field(min_length=2, max_length=60)
    goalKm: int = Field(ge=10, le=10_000)


class JoinTeam(Input):
    action: Literal["join"]
    code: str = Field(min_length=4, max_length=12)


class Contribute(Input):
    action: Literal["contribute"]
    distanceKm: float = Field(gt=0, le=300)


class Leave(Input):
    action: Literal["leave"]


class ManageMember(Input):
    action: Literal["kick", "transfer"]
    userId: PositiveId


class QuestFields(Input):
    title: str = Field(min_length=2, max_length=80)
    detail: str = Field(min_length=2, max_length=160)
    xp: int = Field(ge=10, le=10_000)
    active: StrictBool


class CreateQuest(QuestFields):
    action: Literal["createQuest"]


class UpdateQuest(QuestFields):
    action: Literal["updateQuest"]
    id: PositiveId


class DeleteQuest(Input):
    action: Literal["deleteQuest"]
    id: PositiveId


class EventFields(Input):
    title: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=120)
    distanceKm: float = Field(ge=0.001, le=1000)
    startAt: int = Field(gt=0, le=253402300799000)
    rewardXp: int = Field(ge=10, le=100_000)
    capacity: int = Field(ge=1, le=100_000)
    active: StrictBool


class CreateEvent(EventFields):
    action: Literal["createEvent"]
    slug: Slug


class UpdateEvent(EventFields):
    action: Literal["updateEvent"]
    id: EventId


class DeleteEvent(Input):
    action: Literal["deleteEvent"]
    id: EventId


ActivityInput = Annotated[QuestProgress | EventRegistration | FinishEvent, Field(discriminator="action")]
TeamInput = Annotated[CreateTeam | JoinTeam | Contribute | Leave | ManageMember, Field(discriminator="action")]
AdminInput = Annotated[
    CreateQuest | UpdateQuest | DeleteQuest | CreateEvent | UpdateEvent | DeleteEvent, Field(discriminator="action")
]


@asynccontextmanager
async def lifespan(app):
    app.state.database = database_path()
    initialize(app.state.database)
    yield


app = FastAPI(title="QuestFit API", version="1.0", lifespan=lifespan)


@app.exception_handler(HTTPException)
async def api_error(request, exception):
    return JSONResponse({"error": exception.detail}, status_code=exception.status_code, headers=exception.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exception):
    return JSONResponse({"error": "Проверьте данные формы.", "fields": [
        ".".join(map(str, item["loc"][1:])) for item in exception.errors()
    ]}, status_code=400)


@app.middleware("http")
async def private_api(request, call_next):
    is_api = request.url.path.startswith("/api/")
    if is_api and request.method in {"POST", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin != f"{request.url.scheme}://{request.url.netloc}":
            return JSONResponse({"error": "Источник запроса недоступен."}, status_code=403)
    response = await call_next(request)
    if is_api:
        response.headers["Cache-Control"] = "private, no-store"
    return response


def database(request: Request):
    db = connect(request.app.state.database)
    try:
        yield db
    finally:
        db.close()


Db = Annotated[sqlite3.Connection, Depends(database)]


def b64(value):
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def password_digest(password, salt):
    salt_bytes = base64.urlsafe_b64decode(salt + "=" * (-len(salt) % 4))
    return b64(hashlib.pbkdf2_hmac("sha256", password.encode(), salt_bytes, 120_000))


def token_digest(token):
    return b64(hashlib.sha256(token.encode()).digest())


def current_user(request: Request, db: Db):
    token = request.cookies.get(SESSION_KEY)
    if not token:
        return None
    user = db.execute("""
        SELECT u.id, u.full_name AS fullName, u.email, u.goal
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = ? AND s.expires_at > ?
    """, (token_digest(token), now_ms())).fetchone()
    return dict(user) if user else None


def require_user(user: Annotated[dict | None, Depends(current_user)]):
    if not user:
        raise HTTPException(401, "Войдите в аккаунт.")
    return user


def require_admin(user: Annotated[dict, Depends(require_user)]):
    if user["id"] != 1:
        raise HTTPException(403, "Доступно только владельцу QuestFit.")
    return user


User = Annotated[dict, Depends(require_user)]
OptionalUser = Annotated[dict | None, Depends(current_user)]
Admin = Annotated[dict, Depends(require_admin)]


def issue_session(request, response, db, user):
    token = secrets.token_urlsafe()
    now = now_ms()
    previous = request.cookies.get(SESSION_KEY)
    if previous:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(previous),))
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    db.execute("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
               (token_digest(token), user["id"], now + SESSION_SECONDS * 1000, now))
    response.set_cookie(SESSION_KEY, token, max_age=SESSION_SECONDS, httponly=True,
                        secure=request.url.scheme == "https", samesite="lax")
    return {"user": user}


@app.post("/api/auth/register", status_code=201)
def register(details: Register, request: Request, response: Response, db: Db):
    email = details.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) or len(details.password) < 8:
        raise HTTPException(400, "Укажите корректную почту и пароль от 8 символов.")
    name = " ".join(details.fullName.split())
    if len(name) < 2:
        raise HTTPException(400, "Укажите имя от 2 до 60 символов.")
    goal = details.goal.strip() or GOAL
    salt = secrets.token_urlsafe(18)
    digest = password_digest(details.password, salt)
    with atomic(db):
        if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(409, "Аккаунт с такой почтой уже существует.")
        user_id = db.execute("""
            INSERT INTO users (full_name, email, password_hash, password_salt, goal, created_at) VALUES (?, ?, ?, ?, ?, ?)
        """, (name, email, digest, salt, goal, now_ms())).lastrowid
        return issue_session(request, response, db, {"id": user_id, "fullName": name, "email": email, "goal": goal})


@app.post("/api/auth/login")
def login(details: Login, request: Request, response: Response, db: Db):
    row = db.execute("""
        SELECT id, full_name AS fullName, email, goal, password_hash, password_salt FROM users WHERE email = ?
    """, (details.email.strip().lower(),)).fetchone()
    if not row or not hmac.compare_digest(password_digest(details.password, row["password_salt"]), row["password_hash"]):
        raise HTTPException(401, "Неверная почта или пароль.")
    with atomic(db):
        return issue_session(request, response, db, {key: row[key] for key in ("id", "fullName", "email", "goal")})


@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Db):
    token = request.cookies.get(SESSION_KEY)
    if token:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
    response.delete_cookie(SESSION_KEY, httponly=True, secure=request.url.scheme == "https", samesite="lax")
    return {"success": True}


@app.get("/api/auth/session")
def session(user: OptionalUser):
    return {"user": user}


@app.get("/api/catalog")
def get_catalog(user: OptionalUser, db: Db):
    return catalog(db, user["id"] if user else None)


@app.get("/api/dashboard")
def get_dashboard(user: User, db: Db):
    return dashboard(db, user["id"])


@app.get("/api/workouts")
def get_workouts(user: User, db: Db):
    return {"workouts": workouts(db, user["id"])}


@app.post("/api/workouts", status_code=201)
def add_workout(data: Workout, user: User, db: Db):
    now = now_ms()
    if data.performedAt > now:
        raise HTTPException(400, "Укажите дату в прошлом или сегодня.")
    distance = rounded(data.distanceKm * 1000)
    xp = min(1000, rounded(data.durationMinutes * 4 + data.distanceKm * 20))
    workout_id = db.execute("""
        INSERT INTO workout_logs (user_id, title, activity_type, duration_minutes, distance_meters,
          calories, xp, performed_at, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user["id"], data.title, data.type, data.durationMinutes, distance, data.calories, xp,
          data.performedAt, data.notes, now)).lastrowid
    return {"workout": {**data.model_dump(), "distanceKm": distance / 1000, "id": workout_id, "xp": xp}}


@app.delete("/api/workouts")
def remove_workout(id: PositiveId, user: User, db: Db):
    if not db.execute("DELETE FROM workout_logs WHERE id = ? AND user_id = ?", (id, user["id"])).rowcount:
        raise HTTPException(404, "Тренировка не найдена.")
    return {"deleted": True}


@app.patch("/api/profile")
def save_profile(data: Profile, user: User, db: Db):
    with atomic(db):
        db.execute("UPDATE users SET full_name = ?, goal = ? WHERE id = ?", (data.fullName, data.goal, user["id"]))
        db.execute("""
            INSERT INTO user_preferences (user_id, weekly_goal_minutes, city, notifications_enabled, updated_at)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET
              weekly_goal_minutes = excluded.weekly_goal_minutes, city = excluded.city,
              notifications_enabled = excluded.notifications_enabled, updated_at = excluded.updated_at
        """, (user["id"], data.weeklyGoalMinutes, data.city, data.notificationsEnabled, now_ms()))
        return {"user": {**user, "fullName": data.fullName, "goal": data.goal}, "preferences": preferences(db, user["id"])}


@app.get("/api/activity")
def get_activity(user: User, db: Db):
    return activity(db, user["id"], now_ms())


@app.post("/api/activity")
def save_activity(data: ActivityInput, user: User, db: Db):
    with atomic(db):
        now = now_ms()
        if data.action == "quest":
            update_quest_progress(db, user["id"], data.questId, data.completed, now)
        else:
            update_event_progress(db, user["id"], data.eventSlug, data.action, now, getattr(data, "registered", False))
        return activity(db, user["id"], now)


@app.get("/api/team")
def get_team(user: User, db: Db):
    return {"team": team_state(db, user["id"])}


@app.post("/api/team")
def save_team(data: TeamInput, user: User, db: Db):
    with atomic(db):
        return {"team": change_team(db, user["id"], data)}


def admin_data(db):
    default_city = PREFERENCES["city"]
    users = [dict(user) for user in db.execute("""
        SELECT u.id, u.full_name AS fullName, u.email, u.goal, u.created_at AS createdAt,
               COALESCE(p.city, ?) AS city, t.name AS teamName,
               (SELECT COUNT(*) FROM workout_logs WHERE user_id = u.id) AS workoutCount
        FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
        LEFT JOIN team_members m ON m.user_id = u.id LEFT JOIN teams t ON t.id = m.team_id
        ORDER BY u.id DESC
    """, (default_city,))]
    teams = [dict(team) for team in db.execute("""
        SELECT t.id, t.name, u.full_name AS captainName, COALESCE(p.city, ?) AS city,
               (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS memberCount, t.goal_km AS goalKm
        FROM teams t JOIN users u ON u.id = t.leader_user_id
        LEFT JOIN user_preferences p ON p.user_id = u.id
        ORDER BY t.name COLLATE QF_CASEFOLD, t.id
    """, (default_city,))]
    return {"quests": quests(db), "events": events(db), "users": users, "teams": teams}


@app.get("/api/admin")
def get_admin(_: Admin, db: Db):
    return admin_data(db)


@app.post("/api/admin")
def edit_admin(change: AdminInput, _: Admin, db: Db):
    with atomic(db):
        action = change.action
        if action == "createQuest":
            db.execute("INSERT INTO quest_definitions (title, detail, xp, active, created_at) VALUES (?, ?, ?, ?, ?)",
                       (change.title, change.detail, change.xp, change.active, now_ms()))
        elif action == "updateQuest":
            if not db.execute("UPDATE quest_definitions SET title = ?, detail = ?, xp = ?, active = ? WHERE id = ?",
                              (change.title, change.detail, change.xp, change.active, change.id)).rowcount:
                raise HTTPException(404, "Квест не найден.")
        elif action == "deleteQuest":
            if not db.execute("DELETE FROM quest_definitions WHERE id = ?", (change.id,)).rowcount:
                raise HTTPException(404, "Квест не найден.")
        else:
            edit_event(db, change)
        return admin_data(db)


def edit_event(db, change):
    entries = events(db)
    if change.action == "createEvent":
        if change.slug == DEFAULT_EVENT["slug"] or any(event["slug"] == change.slug for event in entries) or db.execute(
            "SELECT 1 FROM event_finishes WHERE event_slug = ?", (change.slug,)
        ).fetchone():
            raise HTTPException(409, "Идентификатор события уже использовался.")
        existing = None
    else:
        existing = next((event for event in entries if event["id"] == change.id), None)
        if not existing:
            raise HTTPException(404, "Событие не найдено.")
    slug = existing["slug"] if existing else change.slug
    if change.action == "deleteEvent":
        if slug == DEFAULT_EVENT["slug"]:
            db.execute("INSERT OR IGNORE INTO hidden_default_events (slug) VALUES (?)", (slug,))
        db.execute("DELETE FROM event_registrations WHERE event_slug = ?", (slug,))
        db.execute("DELETE FROM events WHERE slug = ?", (slug,))
        return
    if existing and change.capacity < existing["registrations"]:
        raise HTTPException(400, "Мест должно быть не меньше, чем зарегистрированных участников.")
    values = (change.title, change.location, rounded(change.distanceKm * 1000), change.startAt,
              change.rewardXp, change.capacity, change.active)
    if existing and existing["id"] != -1:
        db.execute("""
            UPDATE events SET title = ?, location = ?, distance_meters = ?, start_at = ?, reward_xp = ?,
                capacity = ?, active = ? WHERE id = ?
        """, (*values, existing["id"]))
    else:
        db.execute("""
            INSERT INTO events (slug, title, location, distance_meters, start_at, reward_xp, capacity, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (slug, *values, now_ms()))


@app.get("/", include_in_schema=False)
@app.get("/questfit/", include_in_schema=False)
def home():
    return FileResponse(WEB / "index.html")


@app.get("/runtime.js", include_in_schema=False)
@app.get("/questfit/runtime.js", include_in_schema=False)
def runtime():
    return Response("export const demoMode = false;\n", media_type="text/javascript")


for prefix in ("", "/questfit"):
    app.mount(f"{prefix}/styles", StaticFiles(directory=ROOT / "frontend/styles"))
    app.mount(f"{prefix}/assets", StaticFiles(directory=ROOT / "frontend/assets"))
    app.mount(f"{prefix}/public", StaticFiles(directory=ROOT / "public"))
app.mount("/questfit", StaticFiles(directory=WEB), name="questfit")
app.mount("/", StaticFiles(directory=WEB), name="web")
