import os
import re
import sqlite3
from contextlib import closing, contextmanager
from pathlib import Path
from time import time

ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / ".questfit" / "questfit.sqlite3"


def now_ms():
    return int(time() * 1000)


def casefold_compare(first, second):
    first, second = first.casefold(), second.casefold()
    return (first > second) - (first < second)


def connect(path):
    db = sqlite3.connect(path, timeout=15, check_same_thread=False, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.create_collation("QF_CASEFOLD", casefold_compare)
    db.execute("PRAGMA foreign_keys = ON")
    return db


@contextmanager
def atomic(db):
    db.execute("BEGIN IMMEDIATE")
    try:
        yield
        db.commit()
    except BaseException:
        db.rollback()
        raise


def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.execute("CREATE TABLE IF NOT EXISTS questfit_migrations (name TEXT PRIMARY KEY)")
        for migration in sorted((ROOT / "drizzle").glob("[0-9]*.sql")):
            with atomic(db):
                if db.execute("SELECT 1 FROM questfit_migrations WHERE name = ?", (migration.name,)).fetchone():
                    continue
                for statement in migration.read_text(encoding="utf-8").split("--> statement-breakpoint"):
                    if statement.strip():
                        # The existing migrations are CREATE-only and can also initialize an imported SQLite copy.
                        db.execute(re.sub(r"CREATE (TABLE|(?:UNIQUE )?INDEX) ", r"CREATE \1 IF NOT EXISTS ", statement, count=1))
                db.execute("INSERT INTO questfit_migrations (name) VALUES (?)", (migration.name,))
        db.execute("CREATE TABLE IF NOT EXISTS hidden_default_events (slug TEXT PRIMARY KEY)")


def database_path():
    return Path(os.environ.get("QUESTFIT_DB", DATABASE_PATH)).resolve()
