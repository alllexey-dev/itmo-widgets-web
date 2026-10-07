// Synthetic moderation data for csp-preview.mjs: a link with reports, a new link, a new review and an
// edited review, plus two restrictions. Invented names and numbers only; decisions resolve in memory.
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const author = (isu, name, group = 'M3205') => ({
  isu,
  name,
  pictureUrl: null,
  groups: [{ name: group, course: 2, facultyShortName: 'ФИТиП' }],
});

const history = { approved: 4, rejected: 1, dismissedReports: 0, activeRestrictions: [] };

function linkCase(id, reason, minutes, link, reports = []) {
  const revision = {
    id: `rev-${id}`,
    linkId: `link-${id}`,
    number: 1,
    category: link.category,
    url: link.url,
    title: link.title,
    visibility: 'ALL',
    flowId: null,
    status: 'PENDING',
    submittedAt: minutesAgo(minutes),
    decidedAt: null,
    note: null,
  };
  return {
    id,
    targetType: 'SUBJECT_RESOURCE',
    status: 'OPEN',
    reason,
    openedAt: minutesAgo(minutes),
    decisions: [],
    target: {
      targetType: 'SUBJECT_RESOURCE',
      revision,
      link: {
        id: `link-${id}`,
        subjectId: 101,
        subjectName: link.subjectName,
        periodKey: '2026-1',
        category: link.category,
        url: link.url,
        title: link.title,
        visibility: 'ALL',
        flowId: null,
        audienceLabel: null,
        status: reason === 'REPORTS' ? 'PUBLISHED' : 'PENDING',
        reviewNote: null,
        score: link.score ?? 0,
        updatedAt: minutesAgo(minutes),
      },
      author: link.author,
      reports,
      submitterHistory: history,
    },
  };
}

function reviewCase(id, minutes, review, shown = null) {
  const revision = {
    id: `rev-${id}`,
    reviewId: `review-${id}`,
    number: shown ? 2 : 1,
    subjectTitle: review.subjectTitle,
    text: review.text,
    status: 'PENDING',
    submittedAt: minutesAgo(minutes),
    decidedAt: null,
    note: null,
  };
  return {
    id,
    targetType: 'TEACHER_REVIEW',
    status: 'OPEN',
    reason: 'SUBMISSION',
    openedAt: minutesAgo(minutes),
    decisions: [],
    target: {
      targetType: 'TEACHER_REVIEW',
      revision,
      review: {
        id: `review-${id}`,
        teacherIsu: review.teacherIsu,
        teacherName: review.teacherName,
        anonymous: true,
        status: shown ? 'PUBLISHED' : 'PENDING',
        reviewNote: null,
        shown: shown && { ...revision, id: `rev-${id}-1`, number: 1, status: 'APPROVED', ...shown },
        score: shown ? 3 : 0,
        hidden: false,
        verification: shown ? 'VERIFIED' : 'PENDING',
        verifiedFlowId: null,
      },
      author: review.author,
      reports: [],
      submitterHistory: { ...history, approved: 2, rejected: 0 },
    },
  };
}

const cases = new Map(
  [
    linkCase(
      'qa-link-1',
      'REPORTS',
      49,
      {
        category: 'SCORES',
        title: 'Баллы по матанализу',
        url: 'https://docs.google.com/spreadsheets/d/synthetic-scores/edit',
        subjectName: 'Математический анализ',
        score: -3,
        author: author(311111, 'Константин Константинопольский-Преображенский'),
      },
      [
        { reason: 'SPAM', comment: 'Ссылка ведёт на сторонний курс', createdAt: minutesAgo(60) },
        { reason: 'WRONG_SUBJECT', comment: null, createdAt: minutesAgo(120) },
      ],
    ),
    linkCase('qa-link-2', 'SUBMISSION', 60, {
      category: 'RECORDINGS',
      title: 'Записи лекций по физике, весь семестр',
      url: 'https://disk.yandex.ru/d/synthetic-lectures',
      subjectName: 'Физика',
      author: author(322222, 'Мария Кузнецова'),
    }),
    reviewCase(
      'qa-review-1',
      14 * 60,
      {
        teacherIsu: 123456,
        teacherName: 'Орлов Дмитрий Андреевич',
        subjectTitle: 'Базы данных',
        text: 'Объясняет понятно, на консультациях разбирает каждую задачу и отвечает на вопросы.',
        author: author(333333, 'Иван Петров'),
      },
      {
        subjectTitle: 'Базы данных',
        text: 'Объясняет понятно, но на консультациях торопится и не всегда отвечает на вопросы.',
      },
    ),
    reviewCase('qa-review-2', 26 * 60, {
      teacherIsu: 654321,
      teacherName: null,
      subjectTitle: 'Дискретная математика',
      text: 'Строго, но честно. Задачи на экзамене похожи на семинарские.',
      author: author(344444, 'Пётр Сидоров', 'P3110'),
    }),
  ].map((item) => [item.id, item]),
);

const restrictions = [
  {
    id: 'qa-restriction-1',
    user: author(355555, 'Олег Смирнов'),
    capability: 'SUBMIT_RESOURCES',
    reason: 'Спам в ссылках',
    startsAt: minutesAgo(60 * 24),
    expiresAt: minutesAgo(-60 * 24 * 6),
    revokedAt: null,
    revokedByIsu: null,
    active: true,
    caseId: 'qa-link-1',
  },
  {
    id: 'qa-restriction-2',
    user: author(366666, 'Анна Волкова'),
    capability: 'WRITE_REVIEWS',
    reason: 'Оскорбления в отзывах',
    startsAt: minutesAgo(60 * 24 * 40),
    expiresAt: null,
    revokedAt: minutesAgo(60 * 24 * 2),
    revokedByIsu: 400001,
    active: false,
    caseId: 'qa-review-2',
  },
];

function itemOf(entry) {
  const target = entry.target;
  const review = target.targetType === 'TEACHER_REVIEW';
  return {
    id: entry.id,
    targetType: entry.targetType,
    status: entry.status,
    reason: entry.reason,
    openedAt: entry.openedAt,
    resolvedAt: entry.status === 'OPEN' ? null : minutesAgo(1),
    revision: review ? null : target.revision,
    link: review
      ? null
      : {
          id: target.link.id,
          subjectId: target.link.subjectId,
          subjectName: target.link.subjectName,
          periodKey: target.link.periodKey,
          score: target.link.score,
          hidden: false,
        },
    review: review
      ? {
          id: target.review.id,
          teacherIsu: target.review.teacherIsu,
          subjectTitle: target.revision.subjectTitle,
          excerpt: target.revision.text.slice(0, 160),
          score: target.review.score,
          hidden: false,
          anonymous: true,
        }
      : null,
    author: target.author,
    reportCount: target.reports.length,
  };
}

function pageOf(all, url) {
  const page = Number(url.searchParams.get('page') ?? 0);
  const size = Number(url.searchParams.get('size') ?? 20);
  return { items: all.slice(page * size, (page + 1) * size), page, size, total: all.length };
}

/** The answer for a moderation path, or undefined when the path is not one. */
export async function moderationApi(request, url) {
  const path = url.pathname;
  if (path === '/api/admin/moderation/cases') {
    const status = url.searchParams.get('status') ?? 'OPEN';
    const reason = url.searchParams.get('reason');
    const matching = [...cases.values()].filter(
      (entry) => entry.status === status && (!reason || entry.reason === reason),
    );
    return [200, pageOf(matching.map(itemOf), url)];
  }
  const decision = /^\/api\/admin\/moderation\/cases\/([^/]+)\/decisions$/.exec(path);
  if (decision && request.method === 'POST') {
    const entry = cases.get(decision[1]);
    if (!entry) return [404, null];
    let body = '';
    for await (const chunk of request) body += chunk;
    const { action, note = null } = JSON.parse(body || '{}');
    const keepsOpen = action === 'RESTRICT_USER' || action === 'HIDE_ALL_BY_USER';
    const updated = {
      ...entry,
      status: keepsOpen ? entry.status : 'RESOLVED',
      decisions: [
        ...entry.decisions,
        {
          id: `qa-decision-${entry.decisions.length + 1}`,
          moderatorId: null,
          action,
          note,
          restriction: null,
          createdAt: new Date().toISOString(),
          actor: 'MODERATOR',
        },
      ],
    };
    cases.set(entry.id, updated);
    return [200, updated];
  }
  const single = /^\/api\/admin\/moderation\/cases\/([^/]+)$/.exec(path);
  if (single) {
    const entry = cases.get(single[1]);
    return entry ? [200, entry] : [404, null];
  }
  if (path === '/api/admin/moderation/restrictions') {
    const active = url.searchParams.get('active') !== 'false';
    const isu = url.searchParams.get('isu');
    const matching = restrictions.filter(
      (item) => (!active || item.active) && (!isu || String(item.user.isu) === isu),
    );
    return [200, pageOf(matching, url)];
  }
  return undefined;
}
