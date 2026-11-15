# A person - `/u/:isu`, everyone

`PersonPage` (`src/app/features/people/`) shows one person as the visitor may see them. The
navigation keeps Друзья selected, and `Друзья` above the page leads back to the lists.

## Requests

| Request                                                         | When                                        |
| --------------------------------------------------------------- | ------------------------------------------- |
| `GET /api/users/{isu}`                                          | on opening                                  |
| `GET /api/schedule/lessons/user/{isu}?from=&to=`                | when `capabilities.canViewSchedule` is true |
| `GET /api/sport/users/{isu}/bookings`                           | when `capabilities.canViewSport` is true    |
| `GET /api/users/{isu}/friends`                                  | when `capabilities.canViewFriends` is true  |
| `POST /api/friends/{isu}/request`, `accept`, `reject`, `cancel` | the button of the relationship              |
| `DELETE /api/friends/{isu}`                                     | `Удалить` in the confirmation               |

Backend decides every capability; the page asks only for what the profile opens. Only an explicit
`true` opens a card: missing `capabilities` count as closed. A relationship change forgets
`/api/friends`, the profile, the person's schedule and sport, so the cards follow what the new
relationship opens or closes; the person's friends list is under the profile's key, so it loads
again too and no longer holds the visitor after a removal.

## The header

The avatar, the name (the ISU number stands in for an empty one), every group and the relationship
with its one next step:

| Relationship | Shown                         | Actions                                   |
| ------------ | ----------------------------- | ----------------------------------------- |
| the visitor  | `Это вы`                      | `Ваш профиль` (`/me`)                     |
| `FRIENDS`    | `В друзьях`                   | `Удалить из друзей`, after a confirmation |
| `INCOMING`   | `Хочет добавить вас в друзья` | `Принять`, `Отклонить`                    |
| `OUTGOING`   | `Заявка отправлена`           | `Отменить заявку`                         |
| `NONE`       |                               | `Добавить в друзья`                       |

The confirmation `Удалить из друзей?` says that the person stops seeing what is open to friends
only. Toasts: `<Имя> теперь в друзьях`, `Заявка отправлена`, `Заявка отклонена`,
`Заявка отменена`, `Вы больше не друзья`, or why the change failed. While a change is on its way
the buttons are disabled.

## Cards

- **Расписание**: the lessons the person's app uploaded for 7 days from today in Moscow time, by
  day (`Сегодня, ...`, `Завтра, ...`, then the weekday), each with its time, type and place; a
  lesson without a room shows its format. `На ближайшие 7 дней занятий нет` when the answer is
  empty.
- **Спорт**: the queues the person waits in, with the lesson, the kind under the shared names of
  `lib/sportLabels.ts` (`Очередь на место`, `Автозапись`) and `в очереди`, `место освободилось` or
  `запись открылась`; an auto-sign entry without a found lesson is shown two weeks after its
  sample. Confirmed bookings come as lesson IDs without names, so the card only counts them and
  says where they can be seen (`И 2 подтверждённые записи на занятия: какие именно, видно в
приложении.`). `Записей на спорт нет` when both are empty.
- **Друзья**: the person's friends with their number; each row opens that person. The first six
  are shown, `Показать всех: N` opens the rest.

A card the person does not open says so (`Расписание скрыто`, `Спорт скрыт`,
`Список друзей скрыт`) and asks nothing. A 403 on a card is shown the same way: the owner has just
closed it. A lost session is not that: the card shows its load error under the `Сессия истекла`
dialog. Each card fails on its own with `Повторить`.

An ISU number nobody has (404) shows `Пользователь не найден`; another failure of the profile
offers `Повторить`.

The site never calls My ITMO and shows nothing Backend has no data for: the names of a person's
confirmed sport bookings or a search of people by name.

## Tests

`PersonPage.test.tsx` runs against a person on a Backend-like `socialBackend`
(`src/app/test/student.ts`): a friend with every card and the asked week, an unmatched auto entry,
a long list of friends, denied and missing capabilities with no extra requests, a partly open
profile, a 403 on a card, a lost session, empty cards, removing a friend (confirmed, cancelled,
the cards that close after it and the friends list without the visitor), every relationship with its action and request, a failed
change, the visitor's own page, an unknown person and the retry. `labels.test.ts` covers the Moscow
week and the day titles.
