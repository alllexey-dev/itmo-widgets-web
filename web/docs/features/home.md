# Home - `/`, everyone

Главная is one page for every role; each card loads, empties and fails on its
own.

## Staff

- "Требует внимания" comes first for moderators and administrators and is
  built only from existing admin requests; every row links to its section. A
  moderator sees the open cases
  (`/api/admin/moderation/cases?status=OPEN&size=1`). An administrator also sees
  service credentials (`FAILED`, `EXPIRED`, `expiresSoon`; the Gemini key
  through the AI summaries' `keyStatus`), sport auto-sign (no success for more
  than an hour, or failures in `outcomes7d`), AI summaries (key, daily budget,
  `lastOutcome`, only when `enabled`) and the reviews sync
  (`lastOutcome = FAILED`). A source that did not answer is named in a row
  "Не удалось проверить ..." with "Повторить".
- "За 7 дней" (administrator) summarises the week and links to Статистика
  (`/admin/dashboard`).

## Student cards

- Incoming friend requests with "Принять" and "Отклонить" in the card (up to
  three; "Все" opens `/friends?tab=incoming`). A decision forgets
  `/api/friends` and the person's `/api/users/<isu>`.
- Sport queues the user still waits in, linking to Спорт.
- "Кто видит ваши данные" with the three privacy audiences, linking to
  Профиль.
- The app card on the tertiary container, linking to the landing's `/#download`.
