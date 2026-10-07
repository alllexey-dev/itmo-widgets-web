# A person - `/u/:isu`, everyone

The rail keeps Друзья active. The header shows the person and the relation with
one next step: "Удалить из друзей" (a `ConfirmDialog` with `danger`), accept or
decline their request, cancel one's own request, or add them.

Cards, each requested only when the profile's `capabilities` open it:

- Расписание: `/api/schedule/lessons/user/<isu>` for 7 days from today in
  Moscow time.
- Спорт: `/api/sport/users/<isu>/bookings`; queue entries with lesson names,
  confirmed bookings only as a number.
- Друзья: the person's friends.

Missing `capabilities` (an older Backend) count as closed, and a 403 on a card
shows it as "... скрыто" too. A relation change forgets `/api/friends`, the
profile and the person's schedule and sport keys.

The site never calls My ITMO and shows nothing Backend has no data for: names of
a friend's confirmed sport bookings, people search by name, or a list of one's
own sign-ins.
