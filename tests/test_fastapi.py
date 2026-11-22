import os
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

from questfit_api.database import ROOT, initialize, now_ms
from questfit_api.main import app, password_digest


class QuestFitAPI(unittest.TestCase):
    def setUp(self):
        directory = self.enterContext(TemporaryDirectory())
        self.path = Path(directory) / "test.sqlite3"
        self.enterContext(patch.dict(os.environ, {"QUESTFIT_DB": str(self.path)}))
        self.client = self.enterContext(TestClient(app))

    def register(self, client, email, name="Тестовый атлет"):
        response = client.post("/api/auth/register", json={
            "email": email, "fullName": name, "password": " example password ",
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        return response.json()["user"]

    def admin(self, **body):
        response = self.client.post("/api/admin", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_auth_validation_cookie_and_access(self):
        self.assertEqual(self.client.get("/api/workouts").status_code, 401)
        self.assertEqual(self.client.get("/api/auth/session").json(), {"user": None})
        self.assertEqual(self.client.post("/api/auth/register", json={}).status_code, 400)
        user = self.register(self.client, " OWNER@example.test ")
        self.assertEqual(user["id"], 1)
        self.assertEqual(self.client.get("/api/admin").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout", headers={"Origin": "https://example.test"}).status_code, 403)
        self.assertEqual(self.client.get("/api/auth/session").json()["user"], user)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 200)
        self.assertEqual(self.client.get("/api/auth/session").json(), {"user": None})
        auth = {"email": "owner@example.test", "password": " example password "}
        self.assertEqual(self.client.post("/api/auth/login", json={**auth, "password": auth["password"].strip()}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json=auth).json()["user"], user)
        self.assertEqual(self.client.post("/api/auth/register", json={**auth, "fullName": "Другой атлет"}).status_code, 409)

    def test_workouts_unlimited_history_and_owner_check(self):
        user = self.register(self.client, "workouts@example.test")
        now = now_ms()
        for index in range(31):
            created = self.client.post("/api/workouts", json={
                "title": f"Тренировка {index}", "type": "run", "durationMinutes": 25,
                "distanceKm": 4, "calories": 100, "performedAt": now - index * 100_000,
            })
            self.assertEqual(created.status_code, 201, created.text)
            self.assertEqual(created.json()["workout"]["xp"], 180)
        history = self.client.get("/api/workouts").json()["workouts"]
        self.assertEqual(len(history), 31)
        self.assertEqual(history[-1]["title"], "Тренировка 30")
        self.assertEqual(self.client.get("/api/dashboard").json()["totals"]["workoutXp"], 31 * 180)
        with TestClient(app) as client:
            other = self.register(client, "other@example.test")
            self.assertNotEqual(other["id"], user["id"])
            self.assertEqual(client.get("/api/admin").status_code, 403)
            self.assertEqual(client.delete("/api/workouts", params={"id": history[-1]["id"]}).status_code, 404)
        self.assertTrue(self.client.delete("/api/workouts", params={"id": history[-1]["id"]}).json()["deleted"])
        self.assertEqual(len(self.client.get("/api/workouts").json()["workouts"]), 30)

    def test_quests_midnight_legacy_xp_and_undo(self):
        self.register(self.client, "quests@example.test")
        midnight = 1795374000000
        from questfit_api.domain import quest_period
        self.assertEqual(quest_period(midnight)[1], midnight)
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("INSERT INTO quest_progress VALUES (1, 1, ?)", (midnight - 50,))
            db.commit()
        command = {"action": "quest", "questId": 1, "completed": True}
        with patch("questfit_api.main.now_ms", return_value=midnight):
            activity = self.client.get("/api/activity").json()
            self.assertEqual(activity["completedQuestIds"], [])
            self.assertEqual(activity["questXp"], 40)
            for _ in range(2):
                activity = self.client.post("/api/activity", json=command).json()
                self.assertEqual(activity["completedQuestIds"], [1])
                self.assertEqual(activity["questXp"], 80)
                self.assertEqual(activity["todayQuestXp"], 40)
            undone = self.client.post("/api/activity", json={**command, "completed": False}).json()
            self.assertEqual(undone["questXp"], 40)
            self.assertEqual(undone["todayQuestXp"], 0)

    def test_event_capacity_privacy_finish_and_removal(self):
        self.register(self.client, "host@example.test")
        data = {"title": "Вечерний старт", "slug": "evening-run", "location": "Алматы",
                "distanceKm": 4, "startAt": now_ms() + 100_000, "rewardXp": 150, "capacity": 1, "active": True}
        event = self.admin(action="createEvent", **data)["events"][0]
        command = {"eventSlug": data["slug"], "action": "event", "registered": True}
        finish = {"eventSlug": data["slug"], "action": "finishEvent"}
        with TestClient(app) as athlete:
            self.register(athlete, "athlete@example.test")
            self.assertEqual(athlete.post("/api/activity", json=command).status_code, 200)
            self.assertEqual(self.client.post("/api/activity", json=command).status_code, 409)
            self.assertEqual(athlete.post("/api/activity", json=finish).status_code, 409)
            self.admin(action="updateEvent", id=event["id"], **{**data, "active": False, "startAt": now_ms() - 1000})
            self.assertNotIn(data["slug"], [item["slug"] for item in self.client.get("/api/catalog").json()["events"]])
            self.assertIn(data["slug"], [item["slug"] for item in athlete.get("/api/catalog").json()["events"]])
            for _ in range(2):
                self.assertEqual(athlete.post("/api/activity", json=finish).json()["eventXp"], 150)
            self.assertEqual(athlete.post("/api/activity", json={**command, "registered": False}).status_code, 409)
            self.admin(action="deleteEvent", id=event["id"])
            record = athlete.get("/api/activity").json()
            self.assertEqual(record["eventXp"], 150)
            self.assertEqual(record["registeredEventSlugs"], [])

    def test_profile_city_and_team_read_current_name(self):
        self.register(self.client, "profile@example.test")
        changes = {"fullName": "Новый Атлет", "city": "алматы", "goal": "Подготовка к старту",
                   "weeklyGoalMinutes": 180, "notificationsEnabled": False}
        with TestClient(app) as member:
            member_user = self.register(member, "member@example.test")
            created = self.client.post("/api/team", json={"action": "create", "name": "Рейд", "goalKm": 100}).json()["team"]
            self.assertEqual(member.post("/api/team", json={"action": "join", "code": created["code"]}).status_code, 200)
            self.assertEqual(member.patch("/api/profile", json=changes).status_code, 200)
            self.assertEqual(len(member.get("/api/dashboard").json()["leaderboard"]), 2)
            self.assertFalse(member.get("/api/dashboard").json()["preferences"]["notificationsEnabled"])
            command = {"action": "transfer", "userId": member_user["id"]}
            roster = self.client.post("/api/team", json=command).json()["team"]
            self.assertEqual(roster["leaderId"], member_user["id"])
            self.assertEqual(roster["members"][0]["name"], changes["fullName"])
            self.assertEqual(self.client.post("/api/team", json={"action": "leave"}).json()["team"], None)
            self.assertEqual(len(member.get("/api/team").json()["team"]["members"]), 1)

    def test_existing_sqlite_and_compatible_password(self):
        legacy = self.path.with_name("legacy.sqlite3")
        with closing(sqlite3.connect(legacy)) as db:
            migration = ROOT / "drizzle/0000_quiet_payback.sql"
            db.executescript(migration.read_text(encoding="utf-8"))
            salt = "AAECAwQFBgcICQoLDA0ODxAR"
            digest = password_digest("legacy password", salt)
            db.execute("INSERT INTO users (full_name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
                       ("Старый Атлет", "legacy@example.test", digest, salt, now_ms()))
            db.commit()
        initialize(legacy)
        initialize(legacy)
        with patch.dict(os.environ, {"QUESTFIT_DB": str(legacy)}), TestClient(app) as client:
            response = client.post("/api/auth/login", json={"email": "legacy@example.test", "password": "legacy password"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["user"]["id"], 1)
            self.assertEqual(client.get("/api/activity").json()["questXp"], 0)


if __name__ == "__main__":
    unittest.main()
