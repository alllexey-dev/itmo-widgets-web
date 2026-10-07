# Profile - `/me`, everyone

- The name, groups and role from `/api/web/auth/me`.
- "Кто видит": three `ButtonGroup`s; every choice is saved at once with
  `PUT /api/users/me/privacy` carrying all three fields. On an error the
  previous value comes back and a snackbar says so; a save says "Настройка сохранена".
- An active restriction with the moderator's reason
  (`/api/users/me/restrictions`).
- "Этот вход" with "Выйти".

Account deletion arrives with WV-07; until then the landing's
`/delete-account` page describes it.
