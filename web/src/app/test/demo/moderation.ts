import type { RequestHandler } from 'msw';
import type {
  AdminRestriction,
  ModerationCase,
  ModerationDecision,
  ModerationReport,
} from '../../features/moderation/types';
import {
  decisionOf,
  linkTarget,
  MODERATORS,
  minutesAgo,
  moderationBackend,
  moderationCase,
  restriction,
  restrictionsBackend,
  reviewCase,
  reviewTarget,
  userSummary,
} from '../moderation';
import { authorAt, AUTHORS, personOf, STAFF } from './people';

/**
 * Demo answers of moderation for `npm run dev:demo`: a queue to work through (new links and reviews,
 * edits with diffs, reports, low rating, hidden and deleted targets), resolved and withdrawn cases
 * and restrictions.
 * Invented data only. Decisions and revocations change the state until the module reloads.
 */

const HOUR = 60;
const DAY = 24 * HOUR;

/** The other moderator of the demo; the visitor decides as `moderator` (`MODERATORS`). */
const GLEB = 'moderator-gleb';
const MODERATOR_NAMES = {
  ...MODERATORS,
  [GLEB]: { isu: STAFF.gleb.isu, name: STAFF.gleb.name },
};

function author(index: number) {
  const who = authorAt(index);
  return { authorName: who.name, authorIsu: who.isu };
}

/** A case as built by the factories, with its author in the group the population gives them. */
function inOwnGroup(item: ModerationCase): ModerationCase {
  const who = item.target?.author ? personOf(item.target.author.isu) : undefined;
  if (!item.target || !who) return item;
  return {
    ...item,
    target: { ...item.target, author: { ...item.target.author, groups: [who.group] } },
  };
}

/**
 * How the earlier submissions of each author went, links then reviews, in the order of `AUTHORS`:
 * approved, rejected, reports dismissed. One record per person, so every case of theirs agrees.
 */
const HISTORIES: readonly (readonly [link: Counts, review: Counts])[] = [
  [
    [6, 0, 0],
    [2, 0, 0],
  ],
  [
    [9, 0, 1],
    [1, 1, 0],
  ],
  [
    [3, 1, 0],
    [5, 1, 0],
  ],
  [
    [1, 3, 0],
    [0, 1, 0],
  ],
  [
    [4, 1, 0],
    [2, 0, 0],
  ],
  [
    [3, 0, 2],
    [1, 0, 0],
  ],
  [
    [4, 1, 0],
    [3, 0, 0],
  ],
  [
    [5, 2, 0],
    [0, 2, 0],
  ],
];
type Counts = readonly [approved: number, rejected: number, dismissedReports: number];

/** A case with the history its author has everywhere in the demo. */
function withHistory(item: ModerationCase): ModerationCase {
  const target = item.target;
  if (!target) return item;
  const index = AUTHORS.findIndex((who) => who.isu === target.author.isu);
  const [approved, rejected, dismissedReports] = HISTORIES[index]?.[
    target.targetType === 'TEACHER_REVIEW' ? 1 : 0
  ] ?? [0, 0, 0];
  const submitterHistory = { ...target.submitterHistory, approved, rejected, dismissedReports };
  return { ...item, target: { ...target, submitterHistory } as typeof target };
}

/**
 * A case with its dates in the order Backend would have written them. A submission case opened
 * when its revision was sent; a revision under reports or with a low rating was sent and approved
 * days before, and its approved text is what students see. A review that was decided has been
 * checked against ISU by then.
 */
function inOrder(item: ModerationCase): ModerationCase {
  const target = item.target;
  if (!target) return item;
  const opened = Date.parse(item.openedAt);
  const waits = target.revision.status === 'PENDING';
  // A submission case is about the revision that opened it; the other reasons come later.
  const fresh = item.reason === 'SUBMISSION';
  const sent = fresh ? opened : opened - 6 * DAY * 60_000;
  const submittedAt = new Date(sent).toISOString();
  const decided = fresh
    ? item.decisions.at(-1)?.createdAt
    : new Date(sent + 3_600_000).toISOString();
  const decidedAt = waits ? null : (decided ?? null);
  if (target.targetType === 'SUBJECT_RESOURCE') {
    const revision = { ...target.revision, submittedAt, decidedAt };
    return {
      ...item,
      target: { ...target, revision, link: { ...target.link, updatedAt: submittedAt } },
    };
  }
  const revision = { ...target.revision, submittedAt, decidedAt };
  const approved = revision.status === 'APPROVED';
  const settled = item.status !== 'OPEN' && target.review.verification === 'PENDING';
  return {
    ...item,
    target: {
      ...target,
      revision,
      review: {
        ...target.review,
        shown: target.review.shown ?? (approved ? revision : null),
        verification: settled ? 'VERIFIED' : target.review.verification,
      },
    },
  };
}

function report(
  reason: ModerationReport['reason'],
  comment: string | null,
  minutes: number,
): ModerationReport {
  return { reason, comment, createdAt: minutesAgo(minutes) };
}

function decision(
  id: string,
  action: ModerationDecision['action'],
  minutes: number,
  overrides: Partial<ModerationDecision> = {},
): ModerationDecision {
  return decisionOf(id, action, { createdAt: minutesAgo(minutes), ...overrides });
}

// --- Open cases, oldest decisions first in the queue order Backend uses (newest opened last here).

function editedLink(): ModerationCase {
  const seed = {
    id: 'demo-link-edit',
    title: 'Баллы за семестр, обе группы',
    url: 'https://docs.google.com/spreadsheets/d/1dEmOtAbLe2026/edit#gid=0',
    subjectName: 'Дискретная математика',
    ...author(1),
  };
  const target = linkTarget(seed);
  target.revision.number = 3;
  target.revision.visibility = 'FLOW';
  target.revision.flowId = 7102;
  target.link = {
    ...target.link,
    status: 'PUBLISHED',
    title: 'Баллы за семестр',
    url: 'https://docs.google.com/spreadsheets/d/1oLdTaBlE2025/edit',
    visibility: 'ALL',
    score: 12,
  };
  target.submitterHistory = {
    approved: 9,
    rejected: 0,
    dismissedReports: 1,
    activeRestrictions: [],
  };
  return moderationCase(seed, { openedAt: minutesAgo(12) }, target);
}

function reportedChat(): ModerationCase {
  const seed = {
    id: 'demo-link-reports',
    title: 'Чат потока 2.1',
    url: 'https://t.me/+dEmOiNvItE2026',
    subjectName: 'Операционные системы',
    reason: 'REPORTS' as const,
    ...author(3),
  };
  const target = linkTarget(seed);
  target.revision.category = 'CHAT';
  target.revision.status = 'APPROVED';
  target.link = { ...target.link, category: 'CHAT', status: 'PUBLISHED', score: -2 };
  target.reports = [
    report('SPAM', 'В чате только реклама курсов и ставок', 35),
    report('SPAM', null, 80),
    report('WRONG_SUBJECT', 'Это чат другого потока', 3 * HOUR),
    report('BROKEN', 'Ссылка-приглашение истекла', 5 * HOUR),
  ];
  target.submitterHistory = {
    approved: 1,
    rejected: 3,
    dismissedReports: 0,
    activeRestrictions: [
      {
        id: 'demo-active-1',
        capability: 'VOTE',
        reason: 'Накрутка голосов за свои ссылки',
        startsAt: minutesAgo(3 * DAY),
        expiresAt: minutesAgo(-4 * DAY),
      },
    ],
  };
  return moderationCase(
    seed,
    {
      openedAt: minutesAgo(5 * HOUR),
      decisions: [
        decision('demo-d-auto', 'APPROVE', 9 * DAY, { actor: 'POLICY', moderatorId: null }),
      ],
    },
    target,
  );
}

function downvotedLink(): ModerationCase {
  const seed = {
    id: 'demo-link-votes',
    title: 'Ответы на экзамен 2019',
    url: 'https://disk.yandex.ru/d/dEmOaNsWeRs',
    subjectName: 'Физика',
    reason: 'VOTES' as const,
    ...author(4),
  };
  const target = linkTarget(seed);
  target.revision.category = 'EXAM';
  target.revision.status = 'APPROVED';
  target.link = { ...target.link, category: 'EXAM', status: 'PUBLISHED', score: -7 };
  return moderationCase(seed, { openedAt: minutesAgo(26 * HOUR) }, target);
}

function hiddenLink(): ModerationCase {
  const seed = {
    id: 'demo-link-hidden',
    title: 'Записи лекций, осень',
    url: 'https://vk.com/video/playlist/-204512345_7',
    subjectName: 'Математический анализ',
    reason: 'REPORTS' as const,
    ...author(5),
  };
  const target = linkTarget(seed);
  target.revision.category = 'RECORDINGS';
  target.revision.status = 'APPROVED';
  target.link = { ...target.link, category: 'RECORDINGS', status: 'HIDDEN', score: -4 };
  target.reports = [report('BROKEN', 'Плейлист закрыт владельцем', 2 * DAY)];
  return moderationCase(
    seed,
    {
      openedAt: minutesAgo(2 * DAY),
      decisions: [
        decision('demo-d-hide', 'HIDE', 2 * DAY - 20, { actor: 'POLICY', moderatorId: null }),
      ],
    },
    target,
  );
}

function untitledLongLink(): ModerationCase {
  const seed = {
    id: 'demo-link-long',
    title: '',
    url: 'https://drive.google.com/drive/folders/1dEmO-very-long-folder-identifier-that-does-not-fit-on-one-line-of-the-preview?usp=sharing&resourcekey=0-dEmOkEy',
    subjectName: 'Проектирование и анализ вычислительных алгоритмов для инженерных задач',
    ...author(6),
  };
  const target = linkTarget(seed);
  target.revision.category = 'MATERIALS';
  target.revision.title = null;
  target.revision.visibility = 'FLOW';
  target.revision.flowId = 5120;
  target.link = {
    ...target.link,
    category: 'MATERIALS',
    title: null,
    visibility: 'FLOW',
    flowId: 5120,
    audienceLabel: 'Поток 3.2, лекции',
  };
  target.author = { ...target.author, groups: [] };
  return moderationCase(seed, { openedAt: minutesAgo(44) }, target);
}

const LONG_REVIEW = [
  'Лекции читает по своим слайдам, выкладывает их заранее, так что можно готовиться. На практиках разбирает задачи у доски и не торопит, если что-то непонятно.',
  'Спрашивает строго, но по делу: билеты совпадают с тем, что было на лекциях, дополнительные вопросы только по своей теме. Пересдачи назначает быстро и предупреждает за неделю.',
  'Из минусов: домашние задания проверяет долго, иногда по три недели, и оценки появляются в таблице уже после контрольной. Отвечает в почте не всегда, лучше подходить после пары.',
  'В целом курс полезный, советую ходить на лекции: половина вопросов на экзамене была именно из того, что он рассказывал устно и чего нет в слайдах.',
].join('\n\n');

function newReview(): ModerationCase {
  const seed = {
    id: 'demo-review-new',
    teacherIsu: 150482,
    teacherName: 'Сергей Кузнецов',
    subjectTitle: 'Математический анализ',
    text: LONG_REVIEW,
    ...author(0),
  };
  return reviewCase(seed, { openedAt: minutesAgo(7) });
}

function editedReview(): ModerationCase {
  const seed = {
    id: 'demo-review-edit',
    teacherIsu: 162930,
    teacherName: 'Ольга Тихонова',
    subjectTitle: 'Дискретная математика',
    text: 'Объясняет понятно и быстро, на практиках спрашивает строго, но всегда даёт исправить работу. Автоматы ставит тем, кто сдал все домашние задания.',
    ...author(2),
  };
  const target = reviewTarget(seed);
  target.revision.number = 2;
  target.review = {
    ...target.review,
    anonymous: false,
    status: 'PUBLISHED',
    verification: 'VERIFIED',
    score: 5,
    shown: {
      ...target.revision,
      id: 'demo-rev-approved',
      number: 1,
      subjectTitle: 'Математическая логика',
      text: 'Объясняет понятно и медленно, на практиках спрашивает строго, но всегда даёт исправить работу. Автоматы не ставит.',
      status: 'APPROVED',
      decidedAt: minutesAgo(20 * DAY),
    },
  };
  target.submitterHistory = {
    approved: 5,
    rejected: 1,
    dismissedReports: 0,
    activeRestrictions: [],
  };
  return reviewCase(seed, { openedAt: minutesAgo(25) }, target);
}

function reportedReview(): ModerationCase {
  const seed = {
    id: 'demo-review-reports',
    teacherIsu: 171204,
    teacherName: null,
    subjectTitle: null,
    text: 'Худший преподаватель на кафедре, на пары можно не ходить, всё равно ничему не научит. Принимает только у тех, кто ему нравится.',
    reason: 'REPORTS' as const,
    ...author(7),
  };
  const target = reviewTarget(seed);
  target.revision.status = 'APPROVED';
  target.review = { ...target.review, status: 'PUBLISHED', verification: 'UNVERIFIED', score: -3 };
  target.reports = [
    report('OFFENSIVE', 'Оскорбляет преподавателя, фактов нет', 50),
    report('WRONG_TEACHER', null, 4 * HOUR),
  ];
  target.submitterHistory = {
    approved: 0,
    rejected: 2,
    dismissedReports: 0,
    activeRestrictions: [],
  };
  return reviewCase(seed, { openedAt: minutesAgo(4 * HOUR) }, target);
}

const LINK_SEEDS = [
  [
    'Таблица баллов, поток 1.3',
    'https://docs.google.com/spreadsheets/d/1dEmO13',
    'Линейная алгебра',
    'SCORES',
  ],
  [
    'Очередь на защиту лабораторных',
    'https://docs.google.com/spreadsheets/d/1dEmOqUeUe',
    'Программирование',
    'QUEUE',
  ],
  ['Конспекты лекций', 'https://www.notion.so/demo/lectures-2026', 'История', 'NOTES'],
  ['Задания к практикам', 'https://github.com/demo-course/tasks', 'Базы данных', 'TASKS'],
  ['Материалы курса', 'https://disk.yandex.ru/d/dEmOmAtErIaLs', 'Теория вероятностей', 'MATERIALS'],
  [
    'Записи семинаров',
    'https://rutube.ru/plst/demo-512044',
    'Алгоритмы и структуры данных',
    'RECORDINGS',
  ],
  ['Вопросы к экзамену', 'https://docs.google.com/document/d/1dEmOeXaM', 'Философия', 'EXAM'],
  ['Чат группы', 'https://t.me/+dEmOgRoUp', 'Английский язык', 'CHAT'],
  ['Расписание консультаций', 'https://example.org/consultations', 'Физика', 'OTHER'],
] as const;

const REVIEW_SEEDS = [
  [
    'Анна Соколова',
    'Линейная алгебра',
    'Лекции структурные, на экзамене даёт время подумать. Домашние задания объёмные, но по ним потом легко готовиться.',
  ],
  [
    'Игорь Мельников',
    'Программирование',
    'Требует оформлять код по своим правилам, зато объясняет, зачем это нужно. Лабораторные принимает долго.',
  ],
  [
    'Наталья Громова',
    'История',
    'Интересно рассказывает, на семинарах спрашивает всех по очереди. Зачёт по докладу и тесту.',
  ],
  [
    'Павел Широков',
    'Базы данных',
    'Много практики, мало теории. Проект в конце семестра занимает недели три, начинайте заранее.',
  ],
] as const;

function generatedOpen(): ModerationCase[] {
  const links = Array.from({ length: 22 }, (_, index) => {
    const [title, url, subjectName, category] =
      LINK_SEEDS[index % LINK_SEEDS.length] ?? LINK_SEEDS[0];
    const seed = {
      id: `demo-link-${index + 1}`,
      title: index < LINK_SEEDS.length ? title : `${title}, группа ${index + 1}`,
      url: `${url}-${index + 1}`,
      subjectName,
      ...author(index + 2),
    };
    const target = linkTarget(seed);
    target.revision.category = category;
    target.link = { ...target.link, category };
    target.submitterHistory = {
      approved: index % 6,
      rejected: index % 3,
      dismissedReports: 0,
      activeRestrictions: [],
    };
    return moderationCase(seed, { openedAt: minutesAgo(60 + index * 47) }, target);
  });
  const reviews = Array.from({ length: 8 }, (_, index) => {
    const [teacherName, subjectTitle, text] =
      REVIEW_SEEDS[index % REVIEW_SEEDS.length] ?? REVIEW_SEEDS[0];
    const seed = {
      id: `demo-review-${index + 1}`,
      teacherIsu: 180100 + index * 37,
      teacherName,
      subjectTitle,
      text,
      ...author(index + 5),
    };
    const target = reviewTarget(seed);
    target.review = {
      ...target.review,
      anonymous: index % 2 === 0,
      verification: index % 3 === 0 ? 'VERIFIED' : index % 3 === 1 ? 'PENDING' : 'UNVERIFIED',
    };
    return reviewCase(seed, { openedAt: minutesAgo(95 + index * 130) }, target);
  });
  // Interleaved, so the queue mixes links and reviews the way a real one does.
  return links.flatMap((link, index) => {
    const review = index % 3 === 2 ? reviews[(index - 2) / 3] : undefined;
    return review ? [link, review] : [link];
  });
}

// --- Resolved cases: what the "Решённые" tab and the links from restrictions open.

function resolved(): ModerationCase[] {
  const approved = Array.from({ length: 6 }, (_, index) => {
    const [title, url, subjectName, category] =
      LINK_SEEDS[(index + 3) % LINK_SEEDS.length] ?? LINK_SEEDS[0];
    const seed = {
      id: `demo-done-${index + 1}`,
      title,
      url: `${url}-done-${index + 1}`,
      subjectName,
      ...author(index),
    };
    const target = linkTarget(seed);
    target.revision = {
      ...target.revision,
      category,
      status: 'APPROVED',
      decidedAt: minutesAgo(DAY + index * 90),
    };
    target.link = { ...target.link, category, status: 'PUBLISHED', score: index };
    return moderationCase(
      seed,
      {
        status: 'RESOLVED',
        openedAt: minutesAgo(2 * DAY + index * 90),
        decisions: [
          decision(`demo-done-d-${index + 1}`, 'APPROVE', DAY + index * 90, {
            moderatorId: index % 2 === 0 ? 'moderator' : GLEB,
          }),
        ],
      },
      target,
    );
  });

  const rejectedSeed = {
    id: 'demo-done-rejected',
    title: 'Купить курсовую недорого',
    url: 'https://example.com/kursovye',
    subjectName: 'Экономика',
    ...author(3),
  };
  const rejectedTarget = linkTarget(rejectedSeed);
  rejectedTarget.revision = {
    ...rejectedTarget.revision,
    category: 'OTHER',
    status: 'REJECTED',
    note: 'Спам',
  };
  rejectedTarget.link = {
    ...rejectedTarget.link,
    category: 'OTHER',
    status: 'REJECTED',
    reviewNote: 'Спам',
  };
  const rejected = moderationCase(
    rejectedSeed,
    {
      status: 'RESOLVED',
      openedAt: minutesAgo(3 * DAY),
      decisions: [
        decision('demo-done-d-reject', 'REJECT', 3 * DAY - 30, { note: 'Спам' }),
        decision('demo-done-d-restrict', 'RESTRICT_USER', 3 * DAY - 28, {
          note: 'Реклама в ссылках',
          restriction: { capability: 'SUBMIT_RESOURCES', days: 30 },
        }),
      ],
    },
    rejectedTarget,
  );

  const hiddenSeed = {
    id: 'demo-done-hidden',
    teacherIsu: 150482,
    teacherName: 'Сергей Кузнецов',
    subjectTitle: 'Математический анализ',
    text: 'Отзыв с личными данными преподавателя, скрыт после жалобы.',
    reason: 'REPORTS' as const,
    ...author(7),
  };
  const hiddenTarget = reviewTarget(hiddenSeed);
  hiddenTarget.revision.status = 'APPROVED';
  hiddenTarget.review = { ...hiddenTarget.review, status: 'PUBLISHED', hidden: true, score: -5 };
  hiddenTarget.reports = [report('OTHER', 'Указан домашний адрес', 4 * DAY)];
  const hidden = reviewCase(
    hiddenSeed,
    {
      status: 'RESOLVED',
      openedAt: minutesAgo(4 * DAY),
      decisions: [decision('demo-done-d-hide', 'HIDE', 4 * DAY - 15)],
    },
    hiddenTarget,
  );

  const deleted = moderationCase(
    { id: 'demo-done-deleted', title: '' },
    {
      status: 'RESOLVED',
      openedAt: minutesAgo(6 * DAY),
      decisions: [
        decision('demo-done-d-deleted', 'REJECT', 6 * DAY - 60, { note: 'Не открывается' }),
      ],
    },
    null,
  );

  return [...approved, rejected, hidden, deleted, swept()];
}

/**
 * Everything of one author hidden from a case of theirs: the case stayed open with its link
 * rejected and was then closed. Another waiting link of the author was withdrawn by it.
 */
function swept(): ModerationCase {
  const seed = {
    id: SWEEP_CASE,
    title: 'Ответы к контрольной, все варианты',
    url: 'https://example.com/otvety-kontrolnaya',
    subjectName: 'Линейная алгебра',
    ...author(3),
  };
  const target = linkTarget(seed);
  target.revision = { ...target.revision, category: 'EXAM', status: 'REJECTED' };
  target.link = { ...target.link, category: 'EXAM', status: 'REJECTED' };
  return moderationCase(
    seed,
    {
      status: 'RESOLVED',
      openedAt: minutesAgo(2 * DAY + 40),
      decisions: [
        decision('demo-sweep-d-hide-all', 'HIDE_ALL_BY_USER', 2 * DAY, {
          moderatorId: GLEB,
          note: 'Платные ответы к контрольным',
        }),
        decision('demo-sweep-d-close', 'DISMISS', 2 * DAY - 2, { moderatorId: GLEB }),
      ],
    },
    target,
  );
}

// --- Withdrawn cases: closed without a decision of their own, listed under "Отозванные".

/** The resolved case whose hiding of everything by its author withdrew `SWEPT_CASE`. */
const SWEEP_CASE = 'demo-done-sweep';
const SWEPT_CASE = 'demo-gone-swept';

function withdrawn(): ModerationCase[] {
  const sweptSeed = {
    id: SWEPT_CASE,
    title: 'Решения типового расчёта',
    url: 'https://example.com/tipovoy-raschet',
    subjectName: 'Линейная алгебра',
    ...author(3),
  };
  const sweptLink = linkTarget(sweptSeed);
  sweptLink.revision = { ...sweptLink.revision, category: 'TASKS', status: 'REJECTED' };
  sweptLink.link = { ...sweptLink.link, category: 'TASKS', status: 'REJECTED' };

  const linkSeed = {
    id: 'demo-gone-link',
    title: 'Конспект к коллоквиуму',
    url: 'https://www.notion.so/demo/colloquium',
    subjectName: 'Математический анализ',
    ...author(2),
  };
  const link = linkTarget(linkSeed);
  link.revision = { ...link.revision, category: 'NOTES', status: 'WITHDRAWN' };
  link.link = { ...link.link, category: 'NOTES', status: 'PRIVATE', visibility: 'PRIVATE' };

  const reviewSeed = {
    id: 'demo-gone-review',
    teacherIsu: 162930,
    teacherName: 'Ольга Тихонова',
    subjectTitle: 'Дискретная математика',
    text: 'Первая версия отзыва: автор переписал её до того, как модератор успел посмотреть.',
    ...author(4),
  };
  const review = reviewTarget(reviewSeed);
  review.revision = { ...review.revision, status: 'WITHDRAWN' };

  return [
    moderationCase(
      sweptSeed,
      { status: 'WITHDRAWN', openedAt: minutesAgo(2 * DAY + 90) },
      sweptLink,
    ),
    moderationCase(linkSeed, { status: 'WITHDRAWN', openedAt: minutesAgo(3 * DAY) }, link),
    reviewCase(reviewSeed, { status: 'WITHDRAWN', openedAt: minutesAgo(5 * DAY) }, review),
  ];
}

const cases: ModerationCase[] = [
  newReview(),
  editedLink(),
  editedReview(),
  untitledLongLink(),
  reportedReview(),
  reportedChat(),
  ...generatedOpen(),
  downvotedLink(),
  hiddenLink(),
  ...resolved(),
  ...withdrawn(),
]
  .map(inOwnGroup)
  .map(inOrder)
  .map(withHistory);

const CAPABILITY_CYCLE = ['SUBMIT_RESOURCES', 'WRITE_REVIEWS', 'VOTE', 'REPORT', 'ALL'] as const;
const REASON_CYCLE = [
  'Реклама в ссылках',
  'Оскорбления в отзывах',
  'Накрутка голосов за свои ссылки',
  'Ложные жалобы на чужие ссылки',
  'Повторные нарушения после предупреждений, несколько раз подряд публиковал одно и то же',
] as const;

/** The author whose restrictions show every state at once; the rest share the generated ones. */
const SHOWCASE = authorAt(1);
const OTHERS = Array.from({ length: 8 }, (_, index) => authorAt(index)).filter(
  (who) => who !== SHOWCASE,
);

/** Several restrictions per author: the people behind the cases, each under their own ISU. */
function demoRestrictions(): AdminRestriction[] {
  return Array.from({ length: 27 }, (_, index) => {
    const who = OTHERS[(index + 3) % OTHERS.length] ?? SHOWCASE;
    const ended = index % 4 === 3;
    const forever = index % 5 === 2;
    // A restriction without a term ends only when a moderator lifts it.
    const revoked = ended && (forever || index % 8 === 3);
    const startsAt = minutesAgo((index + 1) * 19 * HOUR);
    const term = forever ? null : minutesAgo(-(index + 2) * DAY);
    return restriction({
      id: `demo-restriction-${index + 1}`,
      user: userSummary({ isu: who.isu, name: who.name, groups: [who.group] }),
      capability: CAPABILITY_CYCLE[index % CAPABILITY_CYCLE.length] ?? 'ALL',
      reason: REASON_CYCLE[index % REASON_CYCLE.length] ?? '',
      startsAt,
      expiresAt: ended && !revoked ? minutesAgo(2 * HOUR) : term,
      revokedAt: revoked ? minutesAgo(5 * HOUR) : null,
      revokedByIsu: revoked ? STAFF.anna.isu : null,
      revokedByName: revoked ? STAFF.anna.name : null,
      active: !ended,
      caseId: index === 0 ? 'demo-done-rejected' : `demo-done-${(index % 6) + 1}`,
    });
  });
}

/** One of each state on one person: with a term, without one, expired, and revoked by hand. */
function showcaseRestrictions(): AdminRestriction[] {
  const user = userSummary({
    isu: SHOWCASE.isu,
    name: SHOWCASE.name,
    groups: [SHOWCASE.group],
  });
  return [
    restriction({
      id: 'demo-user-restriction-1',
      user,
      capability: 'WRITE_REVIEWS',
      reason:
        'Оскорбления в отзыве о преподавателе: текст переписан трижды после отклонения, каждый раз с теми же формулировками',
      startsAt: minutesAgo(2 * DAY),
      expiresAt: minutesAgo(-28 * DAY),
      caseId: 'demo-done-1',
    }),
    restriction({
      id: 'demo-user-restriction-2',
      user,
      capability: 'SUBMIT_RESOURCES',
      reason: 'Спам в ссылках',
      startsAt: minutesAgo(11 * DAY),
      expiresAt: null,
      caseId: 'demo-done-2',
    }),
    restriction({
      id: 'demo-user-restriction-3',
      user,
      capability: 'VOTE',
      reason: 'Накрутка голосов',
      startsAt: minutesAgo(120 * DAY),
      expiresAt: minutesAgo(90 * DAY),
      active: false,
      caseId: 'demo-done-3',
    }),
    restriction({
      id: 'demo-user-restriction-4',
      user,
      capability: 'ALL',
      reason: 'Ошибочное решение, снято после разбора',
      startsAt: minutesAgo(160 * DAY),
      expiresAt: null,
      revokedAt: minutesAgo(158 * DAY),
      revokedByIsu: STAFF.gleb.isu,
      revokedByName: STAFF.gleb.name,
      active: false,
      caseId: 'demo-done-4',
    }),
  ];
}

/**
 * Every restriction of the demo, newest first as Backend lists them. The users demo reads this list
 * for the cards, so it is changed in place.
 */
export const restrictions = [...showcaseRestrictions(), ...demoRestrictions()].sort(
  (a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt),
);

export const handlers: RequestHandler[] = [
  ...restrictionsBackend(restrictions).handlers,
  ...moderationBackend(cases, restrictions, {
    moderators: MODERATOR_NAMES,
    withdrawnBy: { [SWEPT_CASE]: SWEEP_CASE },
  }).handlers,
];
