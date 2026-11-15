# Profile and privacy - `/me`

Open to every signed-in user, from the account menu (`Профиль и приватность`). `ProfilePage`
(`src/app/features/profile/`) shows who the user is, who sees their data, a restriction in force
and the sign-in of this browser, and leads to [the devices](devices.md).

## Requests

| Request                          | When            | What for                                  |
| -------------------------------- | --------------- | ----------------------------------------- |
| the session                      | already loaded  | name, picture, groups, roles, connection  |
| `GET /api/users/me/privacy`      | on opening      | the three audiences                       |
| `PUT /api/users/me/privacy`      | on every choice | saves all three audiences                 |
| `GET /api/users/me/restrictions` | on opening      | the restrictions in force now             |
| `DELETE /api/client/self`        | `Выйти`         | signs this browser out (`session.logout`) |

Saving forgets `/api/users/me/privacy`, the same key Главная reads.

## Page

A warning banner for restrictions, then two columns that become one in a narrow window
(`profile.css`):

- **Who the user is**: the avatar, the name (`displayName`), a line per group (the name, the
  course and the faculty, joined by middle dots; the course is left out when it is 0), the ISU
  number and, for a moderator or an administrator, the role.
- **Кто видит**: Расписание, Спорт and Список друзей, each a segmented control with `Все`,
  `Друзья` and `Никто`. A line above says that a choice applies at once, on the site and in the
  app, and who each audience is: `Все` is any user of ITMO.Widgets, `Друзья` accepted friends
  only, `Никто` the user alone. On a phone every control sits under its name.
- **Этот вход**: the name of the connection (`Chrome, macOS`) and the day it was connected in the
  app, the 30 idle days after which it ends and, for staff, the 7-day rule of phone approvals with
  the day of the last one (`approvedAt`). `Выйти` signs this browser out.
- **Устройства**: what the devices page holds (browsers and programs with access to the user's
  data, phones with the app), where a lost phone is signed out, and the link `Открыть устройства`
  to `/me/devices`.

## Rules

- A choice of an audience shows at once and is saved at once: the `PUT` always carries all three
  fields. `Настройка сохранена` confirms it; on a failure the saved value comes back and the toast
  says `Не удалось сохранить настройку`.
- Saves go one at a time, in the order of the clicks. Two requests in flight could reach Backend
  in the wrong order, and since each carries all three fields the later choice would be lost. A
  queued save builds on the answer to the one before it, so a choice that failed is not saved
  along with the next one. When the queue is empty, the next save starts from the loaded settings
  again.
- Restrictions (`restrictionLine` in `labels.ts`): one banner, `Действует ограничение` or
  `Действуют ограничения`, with a line per restriction: what is forbidden, until when
  (`до 15 окт.`, or `без срока` when `expiresAt` is null) and the moderator's reason. Nothing is
  shown without restrictions. The web only shows them: Backend enforces. Everything a restriction
  forbids happens in the app (subject links, teacher reviews, votes and reports; the cabinet has
  none of them), so each line starts with `В приложении нельзя ...` and names the thing as the app
  does: `ссылки к предметам`, `отзывы о преподавателях`.
- The devices card promises nothing the web cannot do for a lost phone: the web lists phones only,
  and the card says that a phone is signed out in the app on another phone (Профиль → Устройства),
  as the devices page does.
- Sentences that end with a date do not double the period of a short month (`sentence`).
- `Выйти` goes to the login page; a failure other than an already ended connection keeps the user
  signed in and shows `Не удалось выйти`.

## States

| Part         | Loading   | Failure                                                            |
| ------------ | --------- | ------------------------------------------------------------------ |
| audiences    | a spinner | `Не удалось загрузить настройки` with `Повторить`, inside the card |
| restrictions | nothing   | a card `Не удалось проверить ограничения` with `Повторить`         |

The identity and the sign-in come from the session, so they are there as soon as the page opens.

## Tests

`ProfilePage.test.tsx` renders the whole app at `/me` (`profileBackend` in
`src/app/test/account.ts` saves a `PUT` like Backend):

- the name, group, ISU number and role; the saved audiences and who each audience is;
- a choice is saved at once with all three fields; a second choice waits for the first and carries
  both; a choice that failed is not sent with the next one; a failed save puts the saved audience
  back;
- one restriction with its end and reason, several with one that has no end, none, and the retry
  when they cannot be checked;
- the retry when the audiences do not load;
- the sign-in card for a student and for staff, signing out, a failed sign-out, the link to the
  devices and what the card says about a lost phone.
