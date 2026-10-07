# Users - `/admin/users`, administrator

Search by ISU, name or group with a 300 ms pause; the table shows roles (a
two-line list on phones). Search and page are kept in the URL as `q` and `page`.

`/admin/users/:isu` shows access, activity, devices, groups and restrictions:

- The "Модератор" switch asks for confirmation; after a role change the caches
  of `/api/admin/users` and `/api/admin/audit` are forgotten.
- A device without `platform` (Backend before BK-16b) is Android; `platform`
  and `appVersion` show when they arrive.
- "Снять" revokes a restriction after a confirmation and forgets the
  moderation and user caches.
