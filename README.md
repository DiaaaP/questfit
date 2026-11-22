# QuestFit

Фитнес-трекер с журналом тренировок, ежедневными квестами, командным рейдом и регистрацией на спортивные старты. Основная версия использует HTML, CSS и обычный JavaScript, FastAPI на сервере и SQLite для хранения данных.

## Запуск

Нужен Python 3.11 или новее. В PowerShell из корня проекта выполните:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn questfit_api.main:app --host 127.0.0.1 --port 8000
```

На Linux и macOS используйте `.venv/bin/python` вместо `.venv\Scripts\python.exe`.

- Приложение открывается по адресу [127.0.0.1:8000](http://127.0.0.1:8000/).
- Swagger для серверных маршрутов доступен в [`/docs`](http://127.0.0.1:8000/docs).
- SQLite создаётся в `.questfit/questfit.sqlite3`. Путь можно задать через `QUESTFIT_DB`. Миграции применяются при запуске.
- Первому аккаунту на пустой базе доступна админ-панель. В режиме FastAPI аккаунты, тренировки, команды, брони и XP сохраняются в SQLite.
- В админ-панели есть таблицы пользователей и команд с фильтром по городу. Город команды берётся из профиля капитана.

## Данные и публикация

FastAPI работает со схемой прежней D1 и совместим с сохранёнными хешами паролей. Для переноса данных нужна локальная копия базы SQLite с этой схемой. Укажите её в `QUESTFIT_DB` перед запуском. Существующая облачная D1 остаётся на своём хостинге.

[GitHub Pages](https://diaaap.github.io/questfit/) поддерживает браузерное демо. Оно использует существующие ключи `localStorage`, поэтому данные демо остаются доступны на том же адресе. Для локальной сборки этой версии нужен Node.js 22:

```sh
node scripts/build-pages.mjs
python -m http.server 4173 --bind 127.0.0.1 --directory github-pages-dist
```

Для публикации полнофункциональной версии нужен хостинг с Python и постоянным диском для SQLite.

## Структура проекта

| Путь | Назначение |
| --- | --- |
| `web/` | HTML, нативные JS-модули и браузерное демо |
| `frontend/styles/`, `frontend/assets/` | Стили и фотография QuestFit |
| `questfit_api/` | FastAPI, бизнес-логика и доступ к SQLite |
| `drizzle/` | SQL-миграции SQLite, общие с прежней D1 |
| `app/`, `backend/`, `frontend/components/` | Предыдущая сборка Cloudflare Sites, сохранённая для существующей публикации |
| `design/questfit/` | 27 исходных дизайн-экранов |

## API

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Регистрация, вход и выход |
| GET | `/api/auth/session` | Текущая сессия |
| GET | `/api/catalog` | Квесты и доступные события |
| GET, POST | `/api/activity` | Ежедневные отметки, брони и финиши |
| GET | `/api/dashboard` | Сводка, цели, достижения и рейтинг |
| GET, POST, DELETE | `/api/workouts` | Журнал тренировок |
| PATCH | `/api/profile` | Профиль, цель и настройки уведомлений |
| GET, POST | `/api/team` | Состав, приглашения, лидерство и вклад |
| GET, POST | `/api/admin` | Списки пользователей и команд, управление каталогом |

## Проверка

```powershell
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Тесты запускаются на временных SQLite-базах и проверяют сессии, права доступа, старую схему данных, журнал тренировок, ежедневные квесты, награды арены и команды.
