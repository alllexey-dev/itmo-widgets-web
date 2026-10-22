# Profile - `/me`, everyone

- The name, groups and role from the session (`/api/users/me/data`,
  `/api/users/me/roles`).
- "Кто видит": three `ButtonGroup`s; every choice is saved at once with
  `PUT /api/users/me/privacy` carrying all three fields. On an error the
  previous value comes back and a snackbar says so; a save says "Настройка сохранена".
- An active restriction with the moderator's reason
  (`/api/users/me/restrictions`).
- "Этот вход": the connection's name and date (`/api/client/me`), the 30 idle
  days, for staff the date of the last phone approval, and "Выйти".
- "Устройства" opens `/me/devices`.

## Devices - `/me/devices`, everyone

The Backend part of «Устройства» in the app (`GET /api/users/me/devices`), for
a lost phone: everything except ITMO.ID sessions, which only the phone sees and
ends.

- "Подключённые": live connections (revoked ones waiting for the phone to end
  their ITMO session are hidden), most recently used first: name, type and last
  activity, `Этот браузер` on this one, a pill when the client's ITMO session is
  closed or ends within 7 days. `Отключить` revokes after a confirmation
  (`POST /api/users/me/connections/{id}/revoke`); on this browser's row it is
  `Выйти` (`DELETE /api/client/self`).
- Agents and MCP servers list every scope their type allows as switches, with
  the title and description Backend sends (`Accept-Language: ru`). The web only
  narrows (`PUT /api/users/me/connections/{id}/scopes` with the remaining
  scopes): a switch that is off and the last one that is on are disabled; the
  switch moves when Backend answers, "Доступ изменён".
- "Телефоны с приложением": the app installs with device name (or platform),
  app version and OS, last activity and whether pushes are off. `Выйти` on
  another install drops its push registration
  (`POST /api/users/me/installs/{instanceId}/sign-out`); its ITMO session is
  ended from another phone.

Account deletion is not in the web app; the landing's `/delete-account` page
describes it.
