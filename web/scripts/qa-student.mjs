// Synthetic student data for csp-preview.mjs: friends and requests, sport queues, privacy and a restriction,
// and people with every capability on and off. Invented names and numbers only; answers change in memory.
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const at = (days, hour, minute = 0) => {
  const date = new Date(Date.now() + days * DAY);
  date.setUTCHours(hour - 3, minute, 0, 0);
  return date.toISOString();
};
const moscowDate = (days) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
    new Date(Date.now() + days * DAY),
  );

const OPEN = { canViewSchedule: true, canViewSport: true, canViewFriends: true };
const CLOSED = { canViewSchedule: false, canViewSport: false, canViewFriends: false };

const person = (isu, name, group, faculty, relationship, capabilities = OPEN) => ({
  relationship,
  user: {
    isu,
    name,
    pictureUrl: null,
    groups: [{ name: group, course: 2, facultyShortName: faculty }],
    capabilities,
  },
});

const people = new Map(
  [
    person(311111, 'Иван Петров', 'P3212', 'ФПИиКТ', 'FRIENDS'),
    person(311112, 'Мария Кузнецова', 'P3213', 'ФПИиКТ', 'FRIENDS'),
    person(
      311113,
      'Александра-Виктория Константинопольская-Преображенская',
      'M3205',
      'ФИТиП',
      'FRIENDS',
    ),
    person(311114, 'Дарья Волкова', 'P3110', 'ФПИиКТ', 'FRIENDS', CLOSED),
    person(400002, 'Тимур Абдуллаев', 'P3212', 'ФПИиКТ', 'INCOMING', {
      ...CLOSED,
      canViewFriends: true,
    }),
    person(400003, 'Софья Лебедева', 'N3250', 'ФБИТ', 'INCOMING'),
    person(400004, 'Егор Соколов', 'R3238', 'СУиР', 'OUTGOING', CLOSED),
  ].map((profile) => [profile.user.isu, profile]),
);

const lesson = (id, section, start, minutes = 90) => ({
  id,
  sectionId: id,
  sectionName: section,
  sectionLevel: 1,
  level: 1,
  typeId: 1,
  timeSlotId: 1,
  buildingId: 1,
  roomName: 'Спортзал',
  teacherFio: 'Синтетический Преподаватель',
  teacherIsu: 100001,
  start,
  end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
});

const entry = (type, id, target, changes = {}) => ({
  type,
  id,
  position: 3,
  total: 8,
  status: 'WAITING',
  isCancelled: false,
  createdAt: at(-1, 10),
  cancelledAt: null,
  expiredAt: null,
  satisfiedAt: null,
  firstNotifiedAt: null,
  lastNotifiedAt: null,
  notificationAttempts: 0,
  maxNotificationAttempts: 10,
  targetLesson: target,
  ...(type === 'auto'
    ? { prototypeLessonId: target.id, realLesson: null, realLessonId: null }
    : { lessonId: target.id, forceSign: false }),
  ...changes,
});

let entries = [
  entry('free', 1, lesson(11, 'Волейбол', at(2, 15, 20))),
  entry('auto', 2, lesson(12, 'Плавание', at(-8, 8, 20)), { position: 1, total: 4 }),
  entry('free', 3, lesson(13, 'Настольный теннис', at(0, 17)), { status: 'NOTIFIED' }),
  entry('auto', 4, lesson(14, 'Плавание', at(-15, 8, 20)), { status: 'SATISFIED' }),
  entry('free', 5, lesson(15, 'Волейбол', at(-5, 15, 20)), { status: 'EXPIRED' }),
];

let privacy = {
  scheduleVisibility: 'FRIENDS',
  sportVisibility: 'FRIENDS',
  friendsVisibility: 'ALL',
};

const restrictions = [
  {
    id: 'qa-restriction',
    capability: 'SUBMIT_RESOURCES',
    reason: 'Ссылка вела на платный сервис',
    startsAt: at(-2, 12),
    expiresAt: at(8, 12),
  },
];

const subject = (pairId, name, days, start, end, type, room) => ({
  pairId,
  date: moscowDate(days),
  start: `${start}:00`,
  end: `${end}:00`,
  type,
  typeId: 1,
  note: null,
  subjectName: name,
  subjectId: pairId,
  groupName: 'P3212',
  flowId: pairId,
  flowTypeId: 2,
  teacherIsu: null,
  teacherFio: null,
  room,
  building: room ? 'Кронверкский пр., д.49' : null,
  buildingId: room ? 1 : null,
  mainBuildingId: room ? 13 : null,
  format: room ? 'Очный' : 'Дистанционный',
  formatId: room ? 1 : 3,
});

const lessons = [
  subject(1, 'Математический анализ', 0, '08:20', '09:50', 'Лекция', '2328'),
  subject(2, 'Базы данных', 0, '10:00', '11:30', 'Лабораторная', '1404'),
  subject(3, 'Английский язык', 0, '13:30', '15:00', 'Практика', null),
  subject(4, 'Операционные системы', 1, '11:40', '13:10', 'Лекция', '2337'),
  subject(5, 'Физическая культура', 1, '15:20', '16:50', 'Практика', '101'),
];

const RELATION_AFTER = { request: 'OUTGOING', accept: 'FRIENDS', reject: 'NONE', cancel: 'NONE' };
const list = (relationship) => [...people.values()].filter((p) => p.relationship === relationship);

async function bodyOf(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || '{}');
}

/** The answer for a student path, or undefined when the path is not one. */
export async function studentApi(request, url) {
  const path = url.pathname;
  const get = request.method === 'GET';
  if (get && path === '/api/friends') return [200, list('FRIENDS')];
  if (get && path === '/api/friends/requests/incoming') return [200, list('INCOMING')];
  if (get && path === '/api/friends/requests/outgoing') return [200, list('OUTGOING')];
  const action = /^\/api\/friends\/(\d+)(?:\/(request|accept|reject|cancel))?$/.exec(path);
  if (action && (request.method === 'POST' || request.method === 'DELETE')) {
    const isu = Number(action[1]);
    const current = people.get(isu) ?? person(isu, 'Олег Сидоров', 'R3135', 'СУиР', 'NONE', CLOSED);
    const relationship = request.method === 'DELETE' ? 'NONE' : RELATION_AFTER[action[2]];
    const next = { ...current, relationship };
    people.set(isu, next);
    return [200, next];
  }
  const profile = /^\/api\/users\/(\d+)$/.exec(path);
  if (get && profile) {
    const found = people.get(Number(profile[1]));
    return found ? [200, found] : [404, null];
  }
  if (get && /^\/api\/users\/\d+\/friends$/.test(path)) return [200, list('FRIENDS').slice(0, 4)];
  if (get && /^\/api\/schedule\/lessons\/user\/\d+$/.test(path)) return [200, lessons];
  if (get && /^\/api\/sport\/users\/\d+\/bookings$/.test(path)) {
    return [200, { entries: entries.filter((item) => item.id <= 2), lessonIds: [101, 102] }];
  }
  if (get && path === '/api/sport/auto-sign/entry/my') {
    return [200, entries.filter((item) => item.type === 'auto')];
  }
  if (get && path === '/api/sport/free-sign/entry/my') {
    return [200, entries.filter((item) => item.type === 'free')];
  }
  if (get && path === '/api/sport/auto-sign/limits') {
    return [200, { limit: 3, available: 2, nextAvailableAt: at(6, 8) }];
  }
  const cancel = /^\/api\/sport\/(?:auto|free)-sign\/entry\/(\d+)\/cancel$/.exec(path);
  if (cancel && request.method === 'POST') {
    entries = entries.map((item) =>
      item.id === Number(cancel[1]) ? { ...item, isCancelled: true } : item,
    );
    return [200, 'cancelled'];
  }
  if (path === '/api/users/me/privacy') {
    if (request.method === 'PUT') privacy = await bodyOf(request);
    return [200, privacy];
  }
  if (get && path === '/api/users/me/restrictions') return [200, restrictions];
  return undefined;
}
