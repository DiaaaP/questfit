# QuestFit. Дизайн для защиты

[Проект в Stitch](https://stitch.withgoogle.com/projects/2731409007179667316) · [Figma Design](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790) · [Prototype](https://www.figma.com/proto/Y2wWlN8Lfd1os3m5BvB790?node-id=3-2) · [Design System](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=6-300) · [Локальный каталог](index.html)

В Figma 27 редактируемых десктопных фреймов 1440 × 984. Страница Design System содержит палитру, типографику, переменные, компоненты, варианты и паттерны. В Stitch сохранён исходный визуальный стиль QuestFit. Версию Figma пересобрали из компонентов, поэтому композиции могут отличаться от экспорта Stitch.

## Сценарии в Prototype

| Сценарий | Старт и маршрут | Результат |
| --- | --- | --- |
| Регистрация | [02](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-67) → [01](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-2) | Переход на главную из формы регистрации |
| Запись тренировки | [06](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-227) → [07](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-288) → [08](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-342) → [09](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-403) → [06](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-227) | Подтверждение сохранения и возврат в журнал |
| Командный рейд | [14](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-721) → [18](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-923) → [19](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-991) → [подтверждение](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=4-296) → [18](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-923) | Показан перерасчёт общего вклада |
| Запись на событие | [20](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1046) → [21](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1105) → [22](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1167) → [подтверждение](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=4-302) → [20](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1046) | Показано подтверждение участия |

В Figma Prototype формы демонстрируют заполненные состояния и переходы. Рабочие поля приложения и серверная валидация находятся в коде QuestFit. Отдельной реализации в Figma Make в комплекте нет.

## Реестр экранов

| № | Экран | Задача | Figma |
| --- | --- | --- | --- |
| 01 | Главная | Обзор дня, уровня и ближайших действий | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-2) |
| 02 | Регистрация | Создать аккаунт и открыть главную | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-67) |
| 03 | Вход в QuestFit | Войти в уже созданный аккаунт | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-96) |
| 04 | Ежедневные квесты | Выбрать квест и посмотреть XP | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-121) |
| 05 | Квест · Пробежка 3 км | Открыть условия и перейти к записи активности | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-176) |
| 06 | Журнал тренировок | Просмотреть историю и добавить запись | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-227) |
| 07 | Новая тренировка · Вид активности | Выбрать одну из пяти категорий | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-288) |
| 08 | Новая тренировка · Показатели | Ввести дату, длительность и дистанцию | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-342) |
| 09 | Детали тренировки | Проверить сохранённую запись и её вклад в цель | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-403) |
| 10 | Прогресс | Оценить тренировочную нагрузку за неделю | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-457) |
| 11 | Недельная цель | Изменить план в минутах | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-542) |
| 12 | Достижения | Изучить открытые награды и условия новых | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-597) |
| 13 | Рейтинг Алматы | Сравнить XP и найти своё место | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-658) |
| 14 | Команда | Управлять командой и открыть общий рейд | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-721) |
| 15 | Создать команду | Оформить команду и получить место капитана | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-780) |
| 16 | Вступить в команду | Присоединиться по коду приглашения | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-824) |
| 17 | Состав команды | Проверить участников, роли и вклады | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-861) |
| 18 | Командный рейд | Проверить общую цель и личный вклад | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-923) |
| 19 | Вклад в рейд | Записать минуты в общий результат | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-991) |
| 20 | Арена · Календарь | Подобрать спортивное событие по датам | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1046) |
| 21 | Night Run Урал | Посмотреть маршрут и условия участия | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1105) |
| 22 | Запись на событие | Проверить детали и подтвердить участие | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1167) |
| 23 | Профиль спортсмена | Обновить имя, город и фитнес-цель | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1217) |
| 24 | Настройки уведомлений | Выбрать, о чём напоминать | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1278) |
| 25 | Админ-панель | Посмотреть пользователей и открыть редакторы | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1326) |
| 26 | Редактор квестов | Изменить квест и награду | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1391) |
| 27 | Редактор соревнований | Настроить событие и регистрацию | [Фрейм](https://www.figma.com/design/Y2wWlN8Lfd1os3m5BvB790?node-id=3-1454) |
