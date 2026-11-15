# Friends - `/friends`, everyone

`FriendsPage` (`src/app/features/friends/`) shows the visitor's friends and friendship requests in
three tabs and adds a friend by ISU number.

## Requests

| Request                                              | When                                    |
| ---------------------------------------------------- | --------------------------------------- |
| `GET /api/friends`                                   | on opening, all three lists at once     |
| `GET /api/friends/requests/incoming`                 | the same answer as the navigation badge |
| `GET /api/friends/requests/outgoing`                 |                                         |
| `POST /api/friends/{isu}/accept`, `reject`, `cancel` | a button of a request row               |
| `POST /api/friends/{isu}/request`                    | `Отправить заявку` in the dialog        |

Every change forgets `/api/friends` and `/api/users/<isu>`: the three lists load again, because one
answer can move a person between them, and so does that person's page.

## The page

- The header counts friends and incoming requests (`11 друзей · 3 заявки`) and holds `Добавить`.
- Tabs `Друзья`, `Входящие`, `Исходящие`; the two request tabs carry the number of requests that
  wait (the number of friends is in the header). The tab is the query parameter
  `tab=incoming|outgoing`; `Друзья` has no parameter. On a phone the three tabs fit the screen.
- A row is the avatar, the name (the ISU number stands in for an empty one) and the first group; a
  request shows the group's name and when it was sent (`requestedAt`). The row opens the person
  (`/u/:isu`).
- Incoming requests have `Принять` and `Отклонить`, outgoing ones `Отменить`. While an answer is
  on its way the buttons of that row are disabled. Toasts: `<Имя> теперь в друзьях`,
  `Заявка отклонена`, `Заявка отменена`, or why it failed (`Не удалось принять заявку`, ...).
- The search over the friends tab filters the loaded list by name, ISU number or group without a
  request; it is shown while there are friends.
- Empty states: `Друзей пока нет` with `Добавить друга`, `Входящих заявок нет`,
  `Исходящих заявок нет`, and `Никого не нашли` for a search without matches. A list that did not
  load offers `Повторить`.

## Adding by ISU number

`Добавить` opens a dialog with one field. Finding somebody by name needs My ITMO, which only the
app reads. Errors stay under the field, and only the last two come from a request:

| Input                                  | Message                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| not six digits                         | `Номер ИСУ — шесть цифр`                                 |
| the visitor's own number               | `Это ваш номер`                                          |
| somebody in the loaded friends list    | `Этот человек уже у вас в друзьях`                       |
| somebody the visitor has already asked | `Заявка этому человеку уже отправлена`                   |
| Backend answers 404                    | `Этого человека нет в ITMO.Widgets`                      |
| another failure                        | the error text, `Не удалось отправить заявку` by default |

After a request the dialog closes with `Заявка отправлена` and the page opens `Исходящие`. A
request to somebody who has already asked makes a friend at once (Backend answers `FRIENDS`): the
toast says `<Имя> теперь в друзьях` and the page opens `Друзья`. When the lists had not loaded and
Backend answers `FRIENDS` for somebody who was a friend already, the toast says
`<Имя> у вас в друзьях`.

## Tests

`FriendsPage.test.tsx` runs against friendships that change like Backend's (`socialBackend` in
`src/app/test/student.ts`): the lists and the counts, the tab in the address, the date of a
request, the search, accepting, declining and cancelling with the exact requests sent, a failed
answer, the dialog (a sent request, a crossed request, each validation message, a friend and a pending
request that need no request, 404, closing), the
three empty tabs and the retry.
