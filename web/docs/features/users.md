# Users - `/admin/users`, administrator

Search by ISU, name or group with a 300 ms pause; the table shows roles (a
two-line list on phones). Search and page are kept in the URL as `q` and `page`.

`/admin/users/:isu` shows access, activity, devices, groups and restrictions:

- The "Модератор" switch asks for confirmation; after a role change the caches
  of `/api/admin/users` and `/api/admin/audit` are forgotten.
- A device shows the build it last reported, `<version> (<build>)`, its
  platform and channel (GitHub, Google Play, App Store, debug build) and when
  that report came ("Активно 5 мин. назад"). A device that never reported one
  (Android 2.2 and older, or a Backend before 1.8.0) shows "версия: нет
  данных" and counts as Android.
- "Снять" revokes a restriction after a confirmation and forgets the
  moderation and user caches.
