import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decisionOf,
  linkTarget,
  minutesAgo,
  mockModeration,
  moderationCase,
  REVIEW_TEXT,
  reviewCase,
  reviewTarget,
} from '../../test/moderation';
import { findToast, renderApp } from '../../test/render';
import { mockScreenWidth } from '../../test/screen';
import { fail, mockSession, server, userOf } from '../../test/server';
import type { ModerationCase, SubjectLinkTarget } from './types';

const first = moderationCase({ id: 'case-1', title: 'Баллы по матанализу' });
const second = moderationCase({
  id: 'case-2',
  title: 'Записи лекций',
  subjectName: 'Физика',
  authorName: 'Мария Иванова',
});

function queue() {
  return screen.findByRole('list', { name: 'Заявки' });
}

function rows() {
  return within(screen.getByRole('list', { name: 'Заявки' })).getAllByRole('button');
}

function detail() {
  return screen.getByRole('region', { name: 'Заявка' });
}

function openedCase(title: string) {
  return screen.findByRole('heading', { level: 2, name: title });
}

/** The item of the side navigation; its badge counts the open cases. */
function navItem() {
  return within(screen.getByRole('navigation', { name: 'Боковая навигация' })).getByRole('link', {
    name: /Очередь/,
  });
}

/** Picks an option of an Astryx selector by its label. */
async function choose(dialog: HTMLElement, field: string, option: string) {
  await userEvent.click(within(dialog).getByRole('combobox', { name: field }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** A link students already see: its revision was approved, so a case about it is not a submission. */
function published(target: SubjectLinkTarget): SubjectLinkTarget {
  target.revision.status = 'APPROVED';
  target.link.status = 'PUBLISHED';
  return target;
}

/** A moderator on a wide screen, where the first case opens by itself. */
function moderatorOnWideScreen() {
  mockSession(userOf(['MODERATOR']));
  mockScreenWidth(1440);
}

describe('ModerationPage', () => {
  it('lists open cases and opens the first one with the link, author and history', async () => {
    moderatorOnWideScreen();
    mockModeration([first, second]);

    renderApp('/admin/moderation');

    expect(within(await queue()).getAllByRole('button')).toHaveLength(2);
    expect(await openedCase('Математический анализ')).toBeInTheDocument();
    const link = within(detail()).getByRole('region', { name: 'Ссылка' });
    expect(link).toHaveTextContent('Таблица баллов');
    expect(link).toHaveTextContent('Баллы по матанализу');
    expect(link).toHaveTextContent('docs.google.com');
    expect(link).toHaveTextContent('Все');
    expect(within(link).getByRole('link', { name: /Открыть/ })).toHaveAttribute(
      'href',
      'https://docs.google.com/spreadsheets/d/case-1',
    );
    expect(within(detail()).getByRole('region', { name: 'Автор' })).toHaveTextContent(
      'Иван Петров',
    );
    expect(detail()).toHaveTextContent('2026/27, осень');
    expect(detail()).toHaveTextContent('Новая ссылка, одобренных версий ещё нет');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Очередь модерации' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(navItem()).toHaveTextContent('2'));
    expect(navItem()).toHaveAttribute('aria-current', 'page');
  });

  it('lists the shortcuts on a wide screen', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    expect(screen.getByText('следующая и предыдущая')).toBeInTheDocument();
    // The keys that decide sit on the buttons they press, so each names what it does here.
    const approve = screen.getByRole('button', { name: 'Одобрить' });
    expect(approve).toHaveAttribute('aria-keyshortcuts', 'A');
    expect(approve).toHaveTextContent('A');
    const reject = screen.getByRole('button', { name: 'Отклонить' });
    expect(reject).toHaveAttribute('aria-keyshortcuts', 'R');
    expect(reject).toHaveTextContent('R');
    const open = screen.getByRole('link', { name: 'Открыть' });
    expect(open).toHaveAttribute('aria-keyshortcuts', 'O');
    expect(open).toHaveTextContent('O');
  });

  it('shows no keys on the buttons of a phone', async () => {
    mockSession(userOf(['MODERATOR']));
    mockModeration([first]);

    renderApp('/admin/moderation?case=case-1');

    await openedCase('Математический анализ');
    expect(screen.getByRole('button', { name: 'Одобрить' })).toHaveTextContent(/^Одобрить$/);
  });

  it('shows the list first on a phone, then the case instead of it, and goes back', async () => {
    mockSession(userOf(['MODERATOR']));
    mockModeration([first, second]);
    renderApp('/admin/moderation');
    await queue();
    expect(screen.queryByRole('region', { name: 'Заявка' })).not.toBeInTheDocument();
    expect(screen.queryByText('следующая и предыдущая')).not.toBeInTheDocument();
    const entries = history.length;

    await userEvent.click(screen.getByRole('button', { name: /Записи лекций/ }));

    expect(await openedCase('Физика')).toBeInTheDocument();
    expect(location.search).toBe('?case=case-2');
    expect(history.length).toBe(entries);
    await userEvent.click(within(detail()).getByRole('button', { name: 'К списку' }));
    expect(await queue()).toBeInTheDocument();
    expect(location.search).toBe('');
  });

  it('restores the filter, page and case from the address', async () => {
    mockSession(userOf(['MODERATOR']));
    const cases = Array.from({ length: 27 }, (_, index) =>
      moderationCase({
        id: `case-${index + 1}`,
        title: `Ссылка ${index + 1}`,
        reason: 'REPORTS',
        subjectName: `Предмет ${index + 1}`,
      }),
    );
    mockModeration([...cases, moderationCase({ id: 'other', title: 'Другая' })]);

    renderApp('/admin/moderation?reason=REPORTS&page=1&case=case-27');

    expect(await openedCase('Предмет 27')).toBeInTheDocument();
    // On a phone the open case has the screen to itself.
    expect(screen.queryByRole('button', { name: 'Жалобы' })).not.toBeInTheDocument();
    await userEvent.click(within(detail()).getByRole('button', { name: 'К списку' }));
    expect(within(await queue()).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Жалобы' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('26–27 из 27')).toBeInTheDocument();
  });

  it('filters the queue by reason and status and forgets the page and case', async () => {
    moderatorOnWideScreen();
    mockModeration([
      first,
      moderationCase({ id: 'case-3', title: 'Спам-чат', reason: 'REPORTS' }),
      moderationCase({ id: 'case-4', title: 'Старое' }, { status: 'RESOLVED' }),
    ]);
    renderApp('/admin/moderation?case=case-1');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Жалобы' }));

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByRole('list', { name: 'Заявки' })).toHaveTextContent('Спам-чат');
    expect(location.search).toBe('?reason=REPORTS');

    expect(screen.getByRole('button', { name: 'Жалобы' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Все' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));

    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Заявки' })).toHaveTextContent('Старое'),
    );
    expect(rows()).toHaveLength(1);
    expect(location.search).toBe('?status=RESOLVED');
  });

  it('shows what changed against the approved version', async () => {
    moderatorOnWideScreen();
    const target = linkTarget({ id: 'case-1', title: 'Новые баллы' });
    target.revision.number = 2;
    target.link.title = 'Старые баллы';
    target.link.status = 'PUBLISHED';
    mockModeration([moderationCase({ id: 'case-1', title: 'Новые баллы' }, {}, target)]);

    renderApp('/admin/moderation');

    const diff = await screen.findByRole('table', {
      name: 'Изменения относительно одобренной версии',
    });
    const titleRow = within(diff).getByRole('row', { name: /Название/ });
    expect(titleRow).toHaveTextContent('Старые баллы');
    expect(titleRow).toHaveTextContent('Новые баллы');
    expect(titleRow).toHaveTextContent('изменено');
    expect(within(diff).getByRole('row', { name: /Адрес/ })).not.toHaveTextContent('изменено');
  });

  it('shows reports and past decisions', async () => {
    moderatorOnWideScreen();
    const target = linkTarget({ id: 'case-1', title: 'Чат потока', reason: 'REPORTS' });
    target.reports = [{ reason: 'SPAM', comment: 'Реклама курсов', createdAt: minutesAgo(5) }];
    mockModeration([
      moderationCase(
        { id: 'case-1', title: 'Чат потока', reason: 'REPORTS' },
        {
          decisions: [
            decisionOf('d1', 'APPROVE', {
              moderatorId: null,
              createdAt: minutesAgo(600),
              actor: 'POLICY',
            }),
          ],
        },
        target,
      ),
    ]);

    renderApp('/admin/moderation');

    const reports = await screen.findByRole('region', { name: /Жалобы/ });
    expect(reports).toHaveTextContent('Спам');
    expect(reports).toHaveTextContent('Реклама курсов');
    const decisions = screen.getByRole('region', { name: 'Решения' });
    expect(decisions).toHaveTextContent('Одобрено');
    expect(decisions).toHaveTextContent('Автоматически');
    expect(screen.getByRole('list', { name: 'Заявки' })).toHaveTextContent('1 жалоба');
  });

  it('approves a case, moves on to the next one and refreshes the queue', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    expect(await findToast('Ссылка одобрена')).toBeInTheDocument();
    expect(decisions).toEqual([{ caseId: 'case-1', body: { action: 'APPROVE' }, csrf: '1' }]);
    expect(await openedCase('Физика')).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await waitFor(() => expect(navItem()).toHaveTextContent('1'));
  });

  it('hides a link and dismisses its reports', async () => {
    moderatorOnWideScreen();
    const target = published(linkTarget({ id: 'case-1', title: 'Чат потока' }));
    target.reports = [{ reason: 'BROKEN', comment: null, createdAt: minutesAgo(5) }];
    const reported = moderationCase({ id: 'case-1', title: 'Чат потока' }, {}, target);
    const { decisions } = mockModeration([
      reported,
      moderationCase({ id: 'case-2', title: 'Второй чат' }, {}, { ...target }),
    ]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(await findToast('Ссылка скрыта')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Отклонить жалобы' }));

    expect(await findToast('Жалобы отклонены')).toBeInTheDocument();
    expect(decisions.map((decision) => [decision.caseId, decision.body])).toEqual([
      ['case-1', { action: 'HIDE' }],
      ['case-2', { action: 'DISMISS' }],
    ]);
  });

  it('rejects only with a reason', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    const dialog = screen.getByRole('dialog', { name: 'Отклонить ссылку' });
    const submit = within(dialog).getByRole('button', { name: 'Отклонить' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), '   ');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Нет доступа');
    await userEvent.click(submit);

    expect(await findToast('Ссылка отклонена')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({ action: 'REJECT', note: 'Нет доступа' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('restricts the author for the chosen capability and term', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
    const dialog = screen.getByRole('dialog', { name: 'Ограничить автора' });
    const submit = within(dialog).getByRole('button', { name: 'Ограничить' });
    await choose(dialog, 'Что запретить', 'Голосование');
    await choose(dialog, 'Срок', 'Бессрочно');
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Накрутка');
    await userEvent.click(submit);

    expect(await findToast('Автор ограничен')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({
      action: 'RESTRICT_USER',
      note: 'Накрутка',
      restriction: { capability: 'VOTE' },
    });
    expect(await openedCase('Математический анализ')).toBeInTheDocument();
  });

  it('hides everything by the author only after typing the name', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть все ссылки автора' }));
    const dialog = screen.getByRole('dialog', { name: 'Скрыть все ссылки автора?' });
    const confirm = within(dialog).getByRole('button', { name: 'Скрыть' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Иван');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.type(within(dialog).getByRole('textbox'), ' Петров');
    expect(decisions).toHaveLength(0);
    await userEvent.click(confirm);

    expect(await findToast('Ссылки автора скрыты')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({ action: 'HIDE_ALL_BY_USER' });
  });

  it('says a case closed elsewhere is closed and shows its current state', async () => {
    moderatorOnWideScreen();
    const { state } = mockModeration([first]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');
    state.set('case-1', { ...first, status: 'RESOLVED' });

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    expect(await findToast('Заявка уже закрыта или изменилась')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument(),
    );
    expect(within(detail()).getByText('Решена')).toBeInTheDocument();
  });

  it('moves with J and K, prefetching the next case, and approves with A', async () => {
    moderatorOnWideScreen();
    const { decisions, fetched } = mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');
    await waitFor(() => expect(fetched).toContain('case-2'));

    await userEvent.keyboard('j');
    expect(await openedCase('Физика')).toBeInTheDocument();
    expect(location.search).toBe('?case=case-2');
    await userEvent.keyboard('k');
    expect(await openedCase('Математический анализ')).toBeInTheDocument();
    await userEvent.keyboard('a');

    await waitFor(() => expect(decisions).toHaveLength(1));
    expect(decisions[0]).toMatchObject({ caseId: 'case-1', body: { action: 'APPROVE' } });
  });

  it('reads shortcuts by key position, so the Russian layout works too', async () => {
    moderatorOnWideScreen();
    mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    fireEvent.keyDown(document.body, { code: 'KeyJ', key: 'о' });

    expect(await openedCase('Физика')).toBeInTheDocument();
  });

  it('ignores shortcuts with modifiers', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.keyboard('{Control>}j{/Control}{Meta>}a{/Meta}');

    expect(decisions).toHaveLength(0);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Математический анализ' }),
    ).toBeInTheDocument();
  });

  it('opens the reject dialog with R and ignores keys while typing', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.keyboard('r');
    const reason = within(screen.getByRole('dialog', { name: 'Отклонить ссылку' })).getByRole(
      'textbox',
      { name: 'Причина' },
    );
    await userEvent.type(reason, 'ja');

    expect(reason).toHaveValue('ja');
    expect(decisions).toHaveLength(0);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Математический анализ' }),
    ).toBeInTheDocument();
  });

  it('offers to restore a hidden link in a resolved case', async () => {
    moderatorOnWideScreen();
    const target = linkTarget({ id: 'case-9', title: 'Скрытая' });
    target.link.status = 'HIDDEN';
    const { decisions } = mockModeration([
      moderationCase({ id: 'case-9', title: 'Скрытая' }, { status: 'RESOLVED' }, target),
    ]);
    renderApp('/admin/moderation?status=RESOLVED');
    await openedCase('Математический анализ');

    expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Вернуть' }));

    expect(await findToast('Ссылка снова видна')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({ action: 'RESTORE' });
  });

  it('links the author to the user card for administrators only', async () => {
    mockSession(userOf(['ADMIN']));
    mockScreenWidth(1440);
    mockModeration([first]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    expect(
      within(screen.getByRole('region', { name: 'Автор' })).getByRole('link', { name: 'Профиль' }),
    ).toHaveAttribute('href', '/app/admin/users/311111');
  });

  it('says when the queue did not load and loads it again', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);
    let fails = true;
    // Passes through to the handlers above once the failure is over.
    server.use(
      http.get('*/api/admin/moderation/cases', ({ request }) =>
        fails && new URL(request.url).searchParams.get('size') !== '1'
          ? fail(500, 'internal_server_error')
          : undefined,
      ),
    );
    renderApp('/admin/moderation');
    expect(await screen.findByText('Не удалось загрузить заявки')).toBeInTheDocument();
    fails = false;

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await openedCase('Математический анализ')).toBeInTheDocument();
  });

  it('says when a case did not load and loads it again', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);
    let fails = true;
    server.use(
      http.get('*/api/admin/moderation/cases/:id', () =>
        fails ? fail(500, 'internal_server_error') : undefined,
      ),
    );
    renderApp('/admin/moderation');
    expect(await screen.findByText('Не удалось загрузить заявку')).toBeInTheDocument();
    fails = false;

    await userEvent.click(within(detail()).getByRole('button', { name: 'Повторить' }));

    expect(await openedCase('Математический анализ')).toBeInTheDocument();
  });

  it('reports a decision that was not saved and keeps the case open', async () => {
    moderatorOnWideScreen();
    mockModeration([first, second]);
    server.use(
      http.post('*/api/admin/moderation/cases/:id/decisions', () =>
        fail(500, 'internal_server_error'),
      ),
    );
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    expect(await findToast('Не удалось сохранить решение')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Математический анализ' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Одобрить' })).not.toHaveAttribute('aria-disabled'),
    );
    expect(rows()).toHaveLength(2);
  });

  it('says when a case does not exist', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation?case=missing');

    expect(await screen.findByText('Заявка не найдена')).toBeInTheDocument();
  });

  describe('teacher reviews', () => {
    const review = reviewCase({ id: 'review-1' });
    const reviewTitle = 'Сергей Кузнецов';

    it('lists a review with the teacher, the subject and the start of the text', async () => {
      mockSession(userOf(['MODERATOR']));
      mockModeration([review]);

      renderApp('/admin/moderation');

      const row = within(await queue()).getByRole('button');
      expect(row).toHaveTextContent('Отзыв · Сергей Кузнецов');
      expect(row).toHaveTextContent('Математический анализ · Объясняет понятно, на консультациях');
    });

    it('shows the author of an anonymous review, the teacher and the ISU check', async () => {
      moderatorOnWideScreen();
      mockModeration([review]);

      renderApp('/admin/moderation');

      expect(await openedCase(reviewTitle)).toBeInTheDocument();
      const preview = within(detail()).getByRole('region', { name: 'Отзыв' });
      expect(preview).toHaveTextContent('Анонимно');
      expect(preview).toHaveTextContent('Сверка с ИСУ идёт');
      expect(detail()).toHaveTextContent(
        'Отзыв о преподавателе · ИСУ 123456 · Математический анализ',
      );
      expect(preview).toHaveTextContent(REVIEW_TEXT);
      const author = within(detail()).getByRole('region', { name: 'Автор' });
      expect(author).toHaveTextContent('Иван Петров');
      expect(author).toHaveTextContent('ИСУ 311111');
      expect(within(author).queryByRole('link', { name: 'Профиль' })).not.toBeInTheDocument();
    });

    it('says when a review counts because the teacher has a sport lesson', async () => {
      moderatorOnWideScreen();
      const target = reviewTarget({ id: 'review-1' });
      target.review = {
        ...target.review,
        verification: 'VERIFIED',
        verifiedBasis: 'SPORT_TEACHER',
      };
      mockModeration([reviewCase({ id: 'review-1' }, {}, target)]);

      renderApp('/admin/moderation');

      await openedCase(reviewTitle);
      const preview = within(detail()).getByRole('region', { name: 'Отзыв' });
      expect(preview).toHaveTextContent('Ведёт физкультуру');
      expect(preview).not.toHaveTextContent('Преподавал у автора');
    });

    it('names the teacher by ISU when My ITMO does not know the name', async () => {
      moderatorOnWideScreen();
      mockModeration([reviewCase({ id: 'review-1', teacherName: null })]);

      renderApp('/admin/moderation');

      expect(await openedCase('ИСУ 123456')).toBeInTheDocument();
      expect(detail()).toHaveTextContent('Отзыв о преподавателе · имя не найдено');
      expect(rows()[0]).toHaveTextContent('Отзыв · ИСУ 123456');
    });

    it('shows the edited words and subject against the approved version', async () => {
      moderatorOnWideScreen();
      const target = reviewTarget({
        id: 'review-1',
        subjectTitle: 'Дискретная математика',
        text: 'Объясняет понятно и быстро, но спрашивает строго.',
      });
      target.revision.number = 2;
      target.review.status = 'PUBLISHED';
      target.review.shown = {
        ...target.revision,
        id: 'rev-approved',
        number: 1,
        subjectTitle: 'Математический анализ',
        text: 'Объясняет понятно и медленно, но спрашивает строго.',
        status: 'APPROVED',
      };
      mockModeration([reviewCase({ id: 'review-1' }, {}, target)]);

      renderApp('/admin/moderation');

      const diff = await screen.findByRole('table', {
        name: 'Изменения относительно одобренной версии',
      });
      const subject = within(diff).getByRole('row', { name: /Предмет/ });
      expect(subject).toHaveTextContent('Математический анализ');
      expect(subject).toHaveTextContent('Дискретная математика');
      expect(subject).toHaveTextContent('изменено');
      expect(screen.getByRole('deletion')).toHaveTextContent('удалено: медленно');
      expect(screen.getByRole('insertion')).toHaveTextContent('добавлено: быстро');
    });

    it('says when a review has no approved version yet', async () => {
      moderatorOnWideScreen();
      mockModeration([review]);

      renderApp('/admin/moderation');

      expect(await screen.findByText('Новый отзыв, одобренных версий ещё нет')).toBeInTheDocument();
      expect(screen.queryByRole('deletion')).not.toBeInTheDocument();
    });

    it('approves a review', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([review]);
      renderApp('/admin/moderation');
      await openedCase(reviewTitle);

      await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

      expect(await findToast('Отзыв одобрен')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'APPROVE' });
    });

    it('rejects a review with a preset reason', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([review]);
      renderApp('/admin/moderation');
      await openedCase(reviewTitle);

      await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
      const dialog = screen.getByRole('dialog', { name: 'Отклонить отзыв' });
      const preset = within(dialog).getByRole('button', { name: 'Личные данные' });
      await userEvent.click(preset);
      expect(preset).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByRole('textbox', { name: 'Причина' })).toHaveValue('Личные данные');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Отклонить' }));

      expect(await findToast('Отзыв отклонён')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'REJECT', note: 'Личные данные' });
    });

    it('restricts writing reviews by default', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([review]);
      renderApp('/admin/moderation');
      await openedCase(reviewTitle);

      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      const dialog = screen.getByRole('dialog', { name: 'Ограничить автора' });
      expect(within(dialog).getByRole('combobox', { name: 'Что запретить' })).toHaveTextContent(
        'Отзывы',
      );
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Оскорбления');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Ограничить' }));

      expect(await findToast('Автор ограничен')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({
        action: 'RESTRICT_USER',
        note: 'Оскорбления',
        restriction: { capability: 'WRITE_REVIEWS', days: 7 },
      });
    });

    it('hides every review by the author after confirmation', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([review]);
      renderApp('/admin/moderation');
      await openedCase(reviewTitle);

      await userEvent.click(screen.getByRole('button', { name: 'Скрыть все отзывы автора' }));
      const dialog = screen.getByRole('dialog', { name: 'Скрыть все отзывы автора?' });
      expect(dialog).toHaveTextContent(
        'Автор: Иван Петров. Его опубликованные отзывы скроются, отзывы на проверке будут отклонены',
      );
      await userEvent.type(within(dialog).getByRole('textbox'), 'Иван Петров{Enter}');

      expect(await findToast('Отзывы автора скрыты')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'HIDE_ALL_BY_USER' });
    });

    it('says the review was deleted', async () => {
      moderatorOnWideScreen();
      mockModeration([reviewCase({ id: 'review-1' }, { status: 'RESOLVED' }, null)]);

      renderApp('/admin/moderation?status=RESOLVED');

      expect(within(await queue()).getByRole('button')).toHaveTextContent('Отзыв удалён');
      expect(await openedCase('Отзыв удалён')).toBeInTheDocument();
      expect(detail()).toHaveTextContent('Автор удалил отзыв; остались только решения.');
    });

    it('names a wrong-teacher report', async () => {
      moderatorOnWideScreen();
      const target = reviewTarget({ id: 'review-1', reason: 'REPORTS' });
      target.reports = [{ reason: 'WRONG_TEACHER', comment: null, createdAt: minutesAgo(5) }];
      mockModeration([reviewCase({ id: 'review-1', reason: 'REPORTS' }, {}, target)]);

      renderApp('/admin/moderation');

      const reports = await screen.findByRole('region', { name: /Жалобы/ });
      expect(reports).toHaveTextContent('Не тот преподаватель');
    });
  });

  describe('decisions by the state of the case', () => {
    it('does not offer to hide a link nobody sees yet, or to dismiss reports there are none of', async () => {
      moderatorOnWideScreen();
      mockModeration([first]);

      renderApp('/admin/moderation');

      await openedCase('Математический анализ');
      const actions = within(screen.getByRole('group', { name: 'Действия' }));
      expect(actions.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
      expect(actions.getByRole('button', { name: 'Отклонить' })).toBeInTheDocument();
      expect(actions.queryByRole('button', { name: 'Скрыть' })).not.toBeInTheDocument();
      expect(actions.queryByRole('button', { name: 'Отклонить жалобы' })).not.toBeInTheDocument();
    });

    it('keeps a published link with a low rating with A', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'case-1', title: 'Ответы', reason: 'VOTES' }));
      const { decisions } = mockModeration([
        moderationCase({ id: 'case-1', title: 'Ответы', reason: 'VOTES' }, {}, target),
      ]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Оставить' })).toHaveAttribute(
        'aria-keyshortcuts',
        'A',
      );
      expect(screen.getByRole('button', { name: 'Скрыть' })).toHaveAttribute(
        'aria-keyshortcuts',
        'H',
      );

      await userEvent.keyboard('a');

      await waitFor(() => expect(decisions).toHaveLength(1));
      expect(decisions[0]?.body).toEqual({ action: 'APPROVE' });
    });

    it('dismisses the reports of a published link with A and hides it with H', async () => {
      moderatorOnWideScreen();
      const reported = (id: string) => {
        const target = published(linkTarget({ id, title: 'Чат', reason: 'REPORTS' }));
        target.reports = [{ reason: 'SPAM', comment: null, createdAt: minutesAgo(5) }];
        return moderationCase({ id, title: 'Чат', reason: 'REPORTS' }, {}, target);
      };
      const { decisions } = mockModeration([reported('case-1'), reported('case-2')]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      expect(screen.getByRole('button', { name: 'Отклонить жалобы' })).toHaveAttribute(
        'aria-keyshortcuts',
        'A',
      );
      expect(screen.queryByRole('button', { name: 'Оставить' })).not.toBeInTheDocument();

      await userEvent.keyboard('a');
      expect(await findToast('Жалобы отклонены')).toBeInTheDocument();
      await waitFor(() => expect(location.search).toBe('?case=case-2'));
      await screen.findByRole('button', { name: 'Скрыть' });
      await userEvent.keyboard('h');

      expect(await findToast('Ссылка скрыта')).toBeInTheDocument();
      expect(decisions.map((decision) => [decision.caseId, decision.body.action])).toEqual([
        ['case-1', 'DISMISS'],
        ['case-2', 'HIDE'],
      ]);
    });

    it('offers to bring a hidden link back instead of hiding it again', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'case-1', title: 'Записи', reason: 'REPORTS' }));
      target.link.status = 'HIDDEN';
      target.reports = [{ reason: 'BROKEN', comment: null, createdAt: minutesAgo(5) }];
      const { decisions } = mockModeration([
        moderationCase({ id: 'case-1', title: 'Записи', reason: 'REPORTS' }, {}, target),
      ]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      expect(screen.queryByRole('button', { name: 'Скрыть' })).not.toBeInTheDocument();
      expect(within(detail()).getByText('Скрыта', { selector: 'header *' })).toBeInTheDocument();

      // H only hides: on a hidden target it does nothing, so a rhythm of H never undoes itself.
      expect(screen.getByRole('button', { name: 'Вернуть' })).not.toHaveAttribute(
        'aria-keyshortcuts',
      );
      await userEvent.keyboard('h');
      expect(decisions).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'Вернуть' }));

      expect(await findToast('Ссылка снова видна')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'RESTORE' });
    });

    it('says that a link was kept, not approved, when a published one is left as is', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'case-1', title: 'Ответы', reason: 'VOTES' }));
      mockModeration([
        moderationCase({ id: 'case-1', title: 'Ответы', reason: 'VOTES' }, {}, target),
      ]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Оставить' }));

      expect(await findToast('Ссылка оставлена как есть')).toBeInTheDocument();
    });

    it('says what each decision does for the author and for students', async () => {
      moderatorOnWideScreen();
      mockModeration([first]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Что делает каждое решение' }));

      // The same sentences are the tooltips of the buttons.
      expect(
        await screen.findAllByText(
          'Ссылка появится у студентов, которым она адресована. Заявка закроется.',
        ),
      ).not.toHaveLength(0);
      expect(
        screen.getAllByText('Ссылка не будет опубликована. Автор увидит причину в приложении.'),
      ).not.toHaveLength(0);
    });
  });

  describe('keys and the focus', () => {
    it('leaves the keys to a filter that has the focus', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      screen.getByRole('radio', { name: 'Открытые' }).focus();
      await userEvent.keyboard('ja');
      screen.getByRole('button', { name: 'Все' }).focus();
      await userEvent.keyboard('ja');

      expect(decisions).toHaveLength(0);
      expect(location.search).toBe('');
    });

    it('does not decide from the navigation, but still moves through the queue', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      navItem().focus();
      await userEvent.keyboard('a');
      expect(decisions).toHaveLength(0);
      await userEvent.keyboard('j');

      expect(await openedCase('Физика')).toBeInTheDocument();
    });

    it('takes the keys back after a filter was clicked with the mouse', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Проверка' }));
      await openedCase('Математический анализ');
      expect(document.body).toHaveFocus();
      await userEvent.keyboard('a');

      await waitFor(() => expect(decisions).toHaveLength(1));
    });

    it('decides from a row of the queue that has the focus', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: /Записи лекций/ }));
      await openedCase('Физика');
      await userEvent.keyboard('a');

      await waitFor(() => expect(decisions).toHaveLength(1));
      expect(decisions[0]?.caseId).toBe('case-2');
    });

    it('opens the reject dialog on the reason and the restrict dialog on its first field', async () => {
      moderatorOnWideScreen();
      mockModeration([first]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.keyboard('r');
      const reject = screen.getByRole('dialog', { name: 'Отклонить ссылку' });
      expect(within(reject).getByRole('textbox', { name: 'Причина' })).toHaveFocus();
      expect(reject).toHaveTextContent('Автор увидит её в приложении');
      expect(reject).toHaveTextContent('отправить');
      await userEvent.click(within(reject).getByRole('button', { name: 'Отмена' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      const restrict = screen.getByRole('dialog', { name: 'Ограничить автора' });
      expect(within(restrict).getByRole('combobox', { name: 'Что запретить' })).toHaveFocus();
      expect(restrict).toHaveTextContent('Автор увидит её в приложении');
    });

    it('goes on to the next page with J and back to the end of the previous one with K', async () => {
      moderatorOnWideScreen();
      const cases = Array.from({ length: 27 }, (_, index) =>
        moderationCase({
          id: `case-${index + 1}`,
          title: `Ссылка ${index + 1}`,
          subjectName: `Предмет ${index + 1}`,
        }),
      );
      mockModeration(cases);
      renderApp('/admin/moderation?case=case-25');
      await openedCase('Предмет 25');

      await userEvent.keyboard('j');
      expect(await openedCase('Предмет 26')).toBeInTheDocument();
      expect(location.search).toBe('?page=1');
      await waitFor(() => expect(rows()).toHaveLength(2));
      await userEvent.keyboard('k');

      expect(await openedCase('Предмет 25')).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(25));
      expect(location.search).toBe('');
    });
  });

  describe('an author across cases', () => {
    const third = moderationCase({ id: 'case-3', title: 'Чат потока', subjectName: 'Химия' });

    it('shows a new restriction on every case of the author and warns about a second one', async () => {
      moderatorOnWideScreen();
      mockModeration([first, third]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      const dialog = screen.getByRole('dialog', { name: 'Ограничить автора' });
      expect(dialog).not.toHaveTextContent('уже действует');
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Спам');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Ограничить' }));
      expect(await findToast('Автор ограничен')).toBeInTheDocument();
      await userEvent.keyboard('j');
      await openedCase('Химия');

      const restrictions = await within(detail()).findByRole('list', {
        name: 'Действующие ограничения',
      });
      expect(restrictions).toHaveTextContent('Публикация ссылок');
      expect(restrictions).toHaveTextContent('Спам');
      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      expect(screen.getByRole('dialog', { name: 'Ограничить автора' })).toHaveTextContent(
        'Такое ограничение у автора уже действует',
      );
    });

    it('withdraws the other waiting cases of the author when everything of theirs is hidden', async () => {
      moderatorOnWideScreen();
      const other = moderationCase({
        id: 'case-2',
        title: 'Записи лекций',
        subjectName: 'Физика',
        authorName: 'Мария Иванова',
        authorIsu: 322222,
      });
      const { decisions, state } = mockModeration([first, other, third]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await waitFor(() => expect(navItem()).toHaveTextContent('3'));

      await userEvent.click(screen.getByRole('button', { name: 'Скрыть все ссылки автора' }));
      const dialog = screen.getByRole('dialog', { name: 'Скрыть все ссылки автора?' });
      // The name is a confirmation, not a password: its case does not matter.
      await userEvent.type(within(dialog).getByRole('textbox'), 'иван  петров{Enter}');

      expect(await findToast('Ссылки автора скрыты')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'HIDE_ALL_BY_USER' });
      // The case it was decided on stays open; the other case of the same author is gone.
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(screen.getByRole('list', { name: 'Заявки' })).not.toHaveTextContent('Чат потока');
      await waitFor(() => expect(navItem()).toHaveTextContent('2'));
      expect(state.get('case-3')?.status).toBe('WITHDRAWN');
      expect(
        screen.getByRole('heading', { level: 2, name: 'Математический анализ' }),
      ).toBeVisible();
    });
  });

  describe('the case that stays open after everything of the author was hidden', () => {
    async function hideAll() {
      await userEvent.click(screen.getByRole('button', { name: 'Скрыть все ссылки автора' }));
      const dialog = screen.getByRole('dialog', { name: 'Скрыть все ссылки автора?' });
      expect(dialog).toHaveTextContent('заявки по ним перейдут в «Отозванные»');
      await userEvent.type(within(dialog).getByRole('textbox'), 'Иван Петров{Enter}');
      expect(await findToast('Ссылки автора скрыты')).toBeInTheDocument();
    }

    it('shows its link as rejected and offers only to close the case', async () => {
      moderatorOnWideScreen();
      mockModeration([first]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await hideAll();

      const head = within(detail()).getByRole('heading', { level: 2 }).closest('header');
      await waitFor(() => expect(head).toHaveTextContent('Отклонена'));
      const actions = within(screen.getByRole('group', { name: 'Действия' }));
      expect(actions.getByRole('button', { name: 'Закрыть заявку' })).toHaveAttribute(
        'aria-keyshortcuts',
        'A',
      );
      expect(actions.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
      expect(actions.queryByRole('button', { name: 'Оставить' })).not.toBeInTheDocument();
      expect(actions.queryByRole('button', { name: 'Отклонить' })).not.toBeInTheDocument();
      expect(actions.queryByRole('button', { name: 'Скрыть' })).not.toBeInTheDocument();
      expect(screen.queryByText(/одобренных версий ещё нет/)).not.toBeInTheDocument();
    });

    it('closes without approving: the toast, the request and the resolved row say rejected', async () => {
      moderatorOnWideScreen();
      const { decisions, state } = mockModeration([first]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await hideAll();

      await userEvent.click(await screen.findByRole('button', { name: 'Закрыть заявку' }));

      expect(await findToast('Заявка закрыта')).toBeInTheDocument();
      expect(decisions.map((decision) => decision.body.action)).toEqual([
        'HIDE_ALL_BY_USER',
        'DISMISS',
      ]);
      expect(state.get('case-1')?.target?.revision.status).toBe('REJECTED');
      await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));
      await waitFor(() => expect(rows()).toHaveLength(1));
      const [item] = within(screen.getByRole('list', { name: 'Заявки' })).getAllByRole('listitem');
      expect(item).toHaveTextContent('Отклонена');
      expect(item).not.toHaveTextContent('Одобрена');
      // The log names the decision by what it meant here: there were no reports to dismiss.
      await openedCase('Математический анализ');
      const log = within(detail()).getByRole('region', { name: 'Решения' });
      expect(log).toHaveTextContent('Заявка закрыта');
      expect(log).not.toHaveTextContent('Жалобы отклонены');
    });

    it('still logs a dismissal of reports as one', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'case-1', title: 'Чат', reason: 'REPORTS' }));
      target.reports = [{ reason: 'SPAM', comment: null, createdAt: minutesAgo(5) }];
      mockModeration([
        moderationCase({ id: 'case-1', title: 'Чат', reason: 'REPORTS' }, {}, target),
      ]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Отклонить жалобы' }));
      expect(await findToast('Жалобы отклонены')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));

      await openedCase('Математический анализ');
      const log = within(detail()).getByRole('region', { name: 'Решения' });
      expect(log).toHaveTextContent('Жалобы отклонены');
      expect(log).not.toHaveTextContent('Заявка закрыта');
    });

    it('hides a published link of the case itself and offers to bring it back', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'case-1', title: 'Чат', reason: 'REPORTS' }));
      target.reports = [{ reason: 'SPAM', comment: null, createdAt: minutesAgo(5) }];
      mockModeration([
        moderationCase({ id: 'case-1', title: 'Чат', reason: 'REPORTS' }, {}, target),
      ]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await hideAll();

      const head = within(detail()).getByRole('heading', { level: 2 }).closest('header');
      await waitFor(() => expect(head).toHaveTextContent('Скрыта'));
      expect(screen.getByRole('button', { name: 'Вернуть' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Отклонить жалобы' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Скрыть' })).not.toBeInTheDocument();
    });
  });

  describe('withdrawn cases', () => {
    const third = moderationCase({ id: 'case-3', title: 'Чат потока', subjectName: 'Химия' });

    it('lists the cases closed by hiding everything of an author, read-only, with the reason', async () => {
      moderatorOnWideScreen();
      mockModeration([first, third]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await userEvent.click(screen.getByRole('button', { name: 'Скрыть все ссылки автора' }));
      await userEvent.type(
        within(screen.getByRole('dialog', { name: 'Скрыть все ссылки автора?' })).getByRole(
          'textbox',
        ),
        'Иван Петров{Enter}',
      );
      await findToast('Ссылки автора скрыты');

      await userEvent.click(screen.getByRole('radio', { name: 'Отозванные' }));

      expect(await openedCase('Химия')).toBeInTheDocument();
      expect(location.search).toBe('?status=WITHDRAWN');
      expect(rows()).toHaveLength(1);
      expect(rows()[0]).toHaveTextContent('Чат потока');
      const [item] = within(screen.getByRole('list', { name: 'Заявки' })).getAllByRole('listitem');
      expect(item).toHaveTextContent('Отклонена');
      expect(detail()).toHaveTextContent('модератор скрыл всё у автора по другой заявке');
      const withdrawer = within(detail()).getByRole('link', { name: 'по другой заявке' });
      expect(withdrawer).toHaveAttribute('href', '/app/admin/moderation?case=case-1');
      // The tab says what it holds before a case is opened, and a closed case has a final log.
      expect(screen.getByText(/Закрыты без решения модератора по ним/)).toBeInTheDocument();
      expect(within(detail()).getByRole('region', { name: 'Решения' })).toHaveTextContent(
        'Решений нет',
      );
      expect(screen.queryByRole('group', { name: 'Действия' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ограничить' })).not.toBeInTheDocument();
      expect(screen.getByText('Сначала отозванные недавно')).toBeInTheDocument();

      await userEvent.click(withdrawer);
      expect(await openedCase('Математический анализ')).toBeInTheDocument();
      expect(location.search).toBe('?case=case-1');
    });

    it('puts a mark on every row: a review by its revision, a deleted target without one', async () => {
      moderatorOnWideScreen();
      const review = reviewTarget({ id: 'gone-review' });
      review.revision.status = 'WITHDRAWN';
      mockModeration([
        reviewCase(
          { id: 'gone-review' },
          { status: 'WITHDRAWN', openedAt: minutesAgo(10) },
          review,
        ),
        reviewCase(
          { id: 'deleted-review' },
          { status: 'WITHDRAWN', openedAt: minutesAgo(20) },
          null,
        ),
      ]);

      renderApp('/admin/moderation?status=WITHDRAWN');

      await openedCase('Сергей Кузнецов');
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(rows()[0]).toHaveTextContent('Отозван');
      // A deleted target leaves the row nothing to tell but that the case closed by itself.
      expect(rows()[1]).toHaveTextContent('Без решения');
    });

    it('says when the author withdrew the version, and when there are none', async () => {
      moderatorOnWideScreen();
      const target = linkTarget({ id: 'gone', title: 'Конспект' });
      target.revision.status = 'WITHDRAWN';
      const { state } = mockModeration([
        moderationCase({ id: 'gone', title: 'Конспект' }, { status: 'WITHDRAWN' }, target),
      ]);

      renderApp('/admin/moderation?status=WITHDRAWN');

      await openedCase('Математический анализ');
      expect(detail()).toHaveTextContent('автор отозвал эту версию');
      const [item] = within(screen.getByRole('list', { name: 'Заявки' })).getAllByRole('listitem');
      expect(item).toHaveTextContent('Отозвана');

      state.clear();
      await userEvent.click(screen.getByRole('radio', { name: 'Открытые' }));
      await userEvent.click(screen.getByRole('radio', { name: 'Отозванные' }));
      expect(await screen.findByText('Отозванных заявок нет')).toBeInTheDocument();
    });
  });

  it('labels the figures of the author by what they count', async () => {
    moderatorOnWideScreen();
    mockModeration([first, reviewCase({ id: 'review-1' })]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');
    const author = () => within(detail()).getByRole('region', { name: 'Автор' });
    expect(author()).toHaveTextContent('Ссылок одобрено');
    expect(author()).toHaveTextContent('Ссылок отклонено');
    expect(author()).toHaveTextContent('Жалоб автора отклонено');

    await userEvent.keyboard('j');

    await openedCase('Сергей Кузнецов');
    expect(author()).toHaveTextContent('Отзывов одобрено');
    expect(author()).not.toHaveTextContent('Ссылок одобрено');
  });

  describe('closed cases', () => {
    const approved = () => {
      const target = published(linkTarget({ id: 'done-1', title: 'Одобренная' }));
      return moderationCase(
        { id: 'done-1', title: 'Одобренная' },
        {
          status: 'RESOLVED',
          decisions: [decisionOf('d-approve', 'APPROVE', { createdAt: minutesAgo(90) })],
        },
        target,
      );
    };
    const rejected = () => {
      const target = linkTarget({ id: 'done-2', title: 'Отклонённая', subjectName: 'Физика' });
      target.revision.status = 'REJECTED';
      target.link.status = 'REJECTED';
      return moderationCase(
        { id: 'done-2', title: 'Отклонённая', subjectName: 'Физика' },
        {
          status: 'RESOLVED',
          decisions: [
            decisionOf('d-reject', 'REJECT', { note: 'Спам', createdAt: minutesAgo(10) }),
          ],
        },
        target,
      );
    };

    it('says how each case ended in its row, most recently closed first', async () => {
      moderatorOnWideScreen();
      mockModeration([approved(), rejected()]);

      renderApp('/admin/moderation?status=RESOLVED');

      await waitFor(() => expect(rows()).toHaveLength(2));
      const [newest, oldest] = rows();
      expect(newest).toHaveTextContent('Отклонённая');
      expect(oldest).toHaveTextContent('Одобренная');
      const items = within(screen.getByRole('list', { name: 'Заявки' })).getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('Отклонена');
      expect(items[1]).toHaveTextContent('Одобрена');
      // Who decided, with the decision for a screen reader.
      expect(newest).toHaveTextContent('Отклонено: Анна Смирнова');
      expect(screen.getByText('Сначала решённые недавно')).toBeInTheDocument();
    });

    it('says how a review ended and who decided, a policy too', async () => {
      moderatorOnWideScreen();
      const target = reviewTarget({ id: 'done-review', teacherName: 'Ольга Тихонова' });
      target.revision.status = 'REJECTED';
      const auto = published(linkTarget({ id: 'done-auto', title: 'Автоматически' }));
      mockModeration([
        reviewCase(
          { id: 'done-review' },
          {
            status: 'RESOLVED',
            decisions: [decisionOf('d-review', 'REJECT', { createdAt: minutesAgo(5) })],
          },
          target,
        ),
        moderationCase(
          { id: 'done-auto', title: 'Автоматически' },
          {
            status: 'RESOLVED',
            decisions: [
              decisionOf('d-auto', 'APPROVE', {
                createdAt: minutesAgo(50),
                actor: 'POLICY',
                moderatorId: null,
              }),
            ],
          },
          auto,
        ),
      ]);

      renderApp('/admin/moderation?status=RESOLVED');

      expect(await openedCase('Ольга Тихонова')).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(2));
      const [review, policy] = rows();
      expect(review).toHaveTextContent('Отзыв · Ольга Тихонова');
      expect(review).toHaveTextContent('Отклонён');
      expect(review).toHaveTextContent('Анна Смирнова');
      expect(policy).toHaveTextContent('автоматически');
      const head = within(detail()).getByRole('heading', { level: 2 }).closest('header');
      expect(head).toHaveTextContent('Отклонён');
    });

    it('puts the outcome and its time at the top of the case and hides the decision keys', async () => {
      moderatorOnWideScreen();
      mockModeration([approved()]);

      renderApp('/admin/moderation?status=RESOLVED');

      await openedCase('Математический анализ');
      const head = within(detail()).getByRole('heading', { level: 2 }).closest('header');
      // The same word as the queue row, so the two can be matched.
      expect(head).toHaveTextContent('Одобрена');
      expect(head).toHaveTextContent('закрыта');
      expect(screen.getByText('следующая и предыдущая')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Действия' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Одобрить' })).not.toBeInTheDocument();
    });
  });

  it('lists open cases from the one that waits longest and says so', async () => {
    moderatorOnWideScreen();
    mockModeration([
      moderationCase({ id: 'new', title: 'Новая' }, { openedAt: minutesAgo(5) }),
      moderationCase(
        { id: 'old', title: 'Старая', subjectName: 'Физика' },
        { openedAt: minutesAgo(900) },
      ),
    ]);

    renderApp('/admin/moderation');

    expect(await openedCase('Физика')).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent('Старая');
    expect(screen.getByText('Сначала те, что ждут дольше')).toBeInTheDocument();
  });

  it('names the low rating filter shortly on a phone, in one row with the others', async () => {
    mockScreenWidth(375);
    mockSession(userOf(['MODERATOR']));
    mockModeration([first]);

    renderApp('/admin/moderation');

    await queue();
    const filter = screen.getByRole('button', { name: 'Низкий рейтинг' });
    expect(filter).toHaveTextContent('Рейтинг');
    expect(filter).not.toHaveTextContent('Низкий');
  });

  it('gives the lines under the title the full width of the row, beside no mark', async () => {
    moderatorOnWideScreen();
    mockModeration([moderationCase({ id: 'case-1', title: 'Чат', reason: 'REPORTS' })]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    // The mark is part of the title line, not a column next to all three lines.
    expect(within(rows()[0] as HTMLElement).getByText('Жалобы')).toBeInTheDocument();
  });

  it('calls an untitled link the same in the queue and in the case', async () => {
    moderatorOnWideScreen();
    const target = linkTarget({ id: 'case-1', title: '' });
    target.revision.title = null;
    target.link.title = null;
    mockModeration([moderationCase({ id: 'case-1', title: '' }, {}, target)]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    expect(rows()[0]).toHaveTextContent('Без названия');
    expect(within(detail()).getByRole('region', { name: 'Ссылка' })).toHaveTextContent(
      'Без названия',
    );
  });

  it('does not call a published review new', async () => {
    moderatorOnWideScreen();
    const target = reviewTarget({ id: 'review-1', reason: 'REPORTS' });
    target.revision.status = 'APPROVED';
    target.review.status = 'PUBLISHED';
    target.review.shown = target.revision;
    target.reports = [{ reason: 'OFFENSIVE', comment: null, createdAt: minutesAgo(5) }];
    mockModeration([reviewCase({ id: 'review-1', reason: 'REPORTS' }, {}, target)]);

    renderApp('/admin/moderation');

    await openedCase('Сергей Кузнецов');
    expect(screen.queryByText(/одобренных версий ещё нет/)).not.toBeInTheDocument();
  });

  it('says so when the queue is empty, without an empty case pane', async () => {
    moderatorOnWideScreen();
    mockModeration([]);

    renderApp('/admin/moderation');

    expect(await screen.findByText('Очередь пуста')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Заявка' })).not.toBeInTheDocument();
  });

  it('says when a reason filter leaves nothing', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation?reason=VOTES');

    expect(await screen.findByText('Заявок с такой причиной нет')).toBeInTheDocument();
    expect(screen.queryByText('Очередь пуста')).not.toBeInTheDocument();
  });

  it('opens a case that is not in the queue next to the empty queue', async () => {
    moderatorOnWideScreen();
    mockModeration([moderationCase({ id: 'case-4', title: 'Старое' }, { status: 'RESOLVED' })]);

    renderApp('/admin/moderation?case=case-4');

    expect(await openedCase('Математический анализ')).toBeInTheDocument();
    expect(within(detail()).getByText('Решена')).toBeInTheDocument();
    expect(screen.getByText('Очередь пуста')).toBeInTheDocument();
  });

  it('opens the link in a new tab with O', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.keyboard('o');

    expect(open).toHaveBeenCalledWith(
      'https://docs.google.com/spreadsheets/d/case-1',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('keeps the case the moderator moved to when an earlier decision lands', async () => {
    moderatorOnWideScreen();
    const third = moderationCase({ id: 'case-3', title: 'Чат потока', subjectName: 'Химия' });
    const { decisions } = mockModeration([first, second, third]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.keyboard('ajj');

    expect(await openedCase('Химия')).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(decisions.map((decision) => decision.caseId)).toEqual(['case-1']);
    expect(screen.getByRole('heading', { level: 2, name: 'Химия' })).toBeInTheDocument();
    expect(location.search).toBe('?case=case-3');
  });

  it('goes back a page when the last case of a later page is decided', async () => {
    moderatorOnWideScreen();
    const cases = Array.from({ length: 26 }, (_, index) =>
      moderationCase({
        id: `case-${index + 1}`,
        title: `Ссылка ${index + 1}`,
        subjectName: `Предмет ${index + 1}`,
      }),
    );
    mockModeration(cases);
    renderApp('/admin/moderation?page=1');
    await openedCase('Предмет 26');

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    await waitFor(() => expect(rows()).toHaveLength(25));
    expect(location.search).toBe('');
    expect(await openedCase('Предмет 1')).toBeInTheDocument();
  });

  it('never shows cases of the previous filter under the new one', async () => {
    moderatorOnWideScreen();
    const { fetched } = mockModeration([
      first,
      moderationCase(
        { id: 'case-4', title: 'Старое', subjectName: 'История' },
        { status: 'RESOLVED' },
      ),
    ]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');
    fetched.length = 0;

    await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));

    expect(await openedCase('История')).toBeInTheDocument();
    expect(fetched).not.toContain('case-1');
  });

  describe('taking a decision back', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /** The toast lives in a popover, which jsdom leaves out of the accessibility tree. */
    function undoInToast(text: string) {
      return screen.findByRole('button', { name: `Отменить: ${text}`, hidden: true });
    }

    function decisionsLog() {
      return within(detail()).getByRole('region', { name: 'Решения' });
    }

    it('undoes from the toast and opens the case again in its place in the queue', async () => {
      moderatorOnWideScreen();
      const { reverts } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
      await openedCase('Физика');
      await waitFor(() => expect(navItem()).toHaveTextContent('1'));

      await userEvent.click(await undoInToast('Ссылка одобрена'));

      expect(await findToast('Решение отменено, заявка снова в очереди')).toBeInTheDocument();
      expect(reverts).toEqual([{ caseId: 'case-1', decisionId: 'decision-case-1-1', csrf: '1' }]);
      expect(await openedCase('Математический анализ')).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(2));
      expect(rows()[0]).toHaveTextContent('Баллы по матанализу');
      await waitFor(() => expect(navItem()).toHaveTextContent('2'));
      expect(await screen.findByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
      expect(decisionsLog()).toHaveTextContent('Одобрено');
      expect(decisionsLog()).toHaveTextContent('Отменено');
      expect(
        within(decisionsLog()).queryByRole('button', { name: /Отменить/ }),
      ).not.toBeInTheDocument();
    });

    it('has no key for an undo, so no single key takes a decision back', async () => {
      moderatorOnWideScreen();
      const { decisions, reverts } = mockModeration([first, second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await userEvent.keyboard('a');
      await openedCase('Физика');
      await undoInToast('Ссылка одобрена');

      await userEvent.keyboard('uzx{Control>}z{/Control}{Meta>}z{/Meta}{Enter} ');

      expect(reverts).toEqual([]);
      expect(decisions).toHaveLength(1);
    });

    it('offers no undo for a restriction, which is lifted on its own page instead', async () => {
      moderatorOnWideScreen();
      mockModeration([first]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      const dialog = screen.getByRole('dialog', { name: 'Ограничить автора' });
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Спам');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Ограничить' }));

      expect(await findToast('Автор ограничен')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Отменить/, hidden: true }),
      ).not.toBeInTheDocument();
    });

    it('undoes from the log of the case until the window ends, then no longer offers it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      moderatorOnWideScreen();
      const third = moderationCase({ id: 'case-3', title: 'Чат', subjectName: 'Химия' });
      const { reverts } = mockModeration([first, second, third]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');
      await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
      await openedCase('Физика');
      await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
      await openedCase('Химия');

      await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));
      expect(await openedCase('Физика')).toBeInTheDocument();
      expect(decisionsLog()).toHaveTextContent(/можно до \d\d:\d\d/);
      await userEvent.click(
        within(decisionsLog()).getByRole('button', { name: 'Отменить решение «Одобрено»' }),
      );

      expect(await findToast('Решение отменено, заявка снова в очереди')).toBeInTheDocument();
      expect(reverts.map((revert) => revert.caseId)).toEqual(['case-2']);
      // The case stays on screen, open again, while the list of resolved ones lets it go.
      expect(await screen.findByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
      await waitFor(() => expect(rows()).toHaveLength(1));
      expect(rows()[0]).toHaveTextContent('Баллы по матанализу');

      await userEvent.click(rows()[0] as HTMLElement);
      await openedCase('Математический анализ');
      const undo = () =>
        within(decisionsLog()).queryByRole('button', { name: 'Отменить решение «Одобрено»' });
      expect(undo()).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(10 * 60_000 + 1_000);
      await waitFor(() => expect(undo()).not.toBeInTheDocument());
      expect(decisionsLog()).not.toHaveTextContent('можно до');
    });

    it('takes back hiding from a resolved case: the target is hidden again, the case stays resolved', async () => {
      moderatorOnWideScreen();
      const target = published(linkTarget({ id: 'done-1', title: 'Скрытая' }));
      target.link.status = 'HIDDEN';
      mockModeration([
        moderationCase(
          { id: 'done-1', title: 'Скрытая' },
          {
            status: 'RESOLVED',
            decisions: [decisionOf('d-hide', 'HIDE', { createdAt: minutesAgo(60) })],
          },
          target,
        ),
      ]);
      renderApp('/admin/moderation?status=RESOLVED');
      await openedCase('Математический анализ');
      // A decision taken before this session is past its window: nothing to take back.
      expect(
        within(decisionsLog()).queryByRole('button', { name: /Отменить/ }),
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Вернуть' }));
      await findToast('Ссылка снова видна');

      await userEvent.click(await undoInToast('Ссылка снова видна'));

      expect(await findToast('Решение отменено, ссылка снова скрыта')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Вернуть' })).toBeInTheDocument();
      expect(rows()).toHaveLength(1);
    });

    describe('says why Backend refused', () => {
      it('when the ten minutes have passed', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        moderatorOnWideScreen();
        const { reverts } = mockModeration([first, second]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
        const undo = await undoInToast('Ссылка одобрена');

        vi.setSystemTime(Date.now() + 11 * 60_000);
        await userEvent.click(undo);

        expect(
          await findToast('Время на отмену вышло: решение можно отменить в течение 10 минут'),
        ).toBeInTheDocument();
        expect(reverts).toHaveLength(1);
        expect(await openedCase('Физика')).toBeInTheDocument();
      });

      it('when another decision came after it', async () => {
        moderatorOnWideScreen();
        mockModeration([
          moderationCase(
            { id: 'case-1', title: 'Чат' },
            {},
            published(linkTarget({ id: 'case-1', title: 'Чат' })),
          ),
        ]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
        const undoHide = await undoInToast('Ссылка скрыта');
        await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));
        await openedCase('Математический анализ');
        await userEvent.click(await screen.findByRole('button', { name: 'Вернуть' }));
        await findToast('Ссылка снова видна');

        await userEvent.click(undoHide);

        expect(
          await findToast(
            'После этого решения по заявке приняли другое, отменить можно только последнее',
          ),
        ).toBeInTheDocument();
      });

      it('when it was already taken back elsewhere', async () => {
        moderatorOnWideScreen();
        const { state } = mockModeration([first, second]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
        const undo = await undoInToast('Ссылка одобрена');
        // Another tab was quicker.
        const decided = state.get('case-1') as ModerationCase;
        state.set('case-1', {
          ...decided,
          status: 'OPEN',
          decisions: decided.decisions.map((item) => ({
            ...item,
            revertedAt: new Date().toISOString(),
          })),
        });

        await userEvent.click(undo);

        expect(await findToast('Это решение уже отменено')).toBeInTheDocument();
      });

      it('when the author changed the link since', async () => {
        moderatorOnWideScreen();
        const { state } = mockModeration([first, second]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
        const undo = await undoInToast('Ссылка одобрена');
        const decided = state.get('case-1') as ModerationCase;
        const target = decided.target as SubjectLinkTarget;
        state.set('case-1', {
          ...decided,
          target: { ...target, link: { ...target.link, title: 'Переименована автором' } },
        });

        await userEvent.click(undo);

        expect(
          await findToast(
            'Ссылка изменилась после решения: её отредактировал автор, задело другое решение или по ней открыта новая заявка. Отменить уже нельзя',
          ),
        ).toBeInTheDocument();
      });

      it('when the link was deleted', async () => {
        moderatorOnWideScreen();
        const { state } = mockModeration([first, second]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
        const undo = await undoInToast('Ссылка одобрена');
        state.set('case-1', { ...(state.get('case-1') as ModerationCase), target: null });

        await userEvent.click(undo);

        expect(await findToast('Ссылку удалили, решение уже не отменить')).toBeInTheDocument();
      });

      it('when the decision is another moderator’s', async () => {
        moderatorOnWideScreen();
        mockModeration([first, second]);
        renderApp('/admin/moderation');
        await openedCase('Математический анализ');
        await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));
        const undo = await undoInToast('Ссылка одобрена');
        server.use(
          http.post('*/api/admin/moderation/cases/:id/decisions/:decisionId/revert', () =>
            fail(403, 'permission_denied'),
          ),
        );

        await userEvent.click(undo);

        expect(
          await findToast(
            'Отменить решение может только модератор, который его принял, или администратор',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('the flows a link could be shown to', () => {
    const FLOWS = [
      { flowId: 3200, label: 'ФИЗ ПИИКТ 3.2', typeId: 1, depth: 1 },
      { flowId: 3201, label: 'ФИЗ ПИИКТ 3.2.1', typeId: 2, depth: 2 },
      { flowId: 3202, label: 'ФИЗ ПИИКТ 3.2.2', typeId: 2, depth: 2 },
    ];

    /** A new link the author showed to the practice flow 3.2.1, with [flowOptions] as sent. */
    function flowCase(
      flowOptions: SubjectLinkTarget['revision']['flowOptions'] = FLOWS,
    ): ModerationCase {
      const target = linkTarget({ id: 'case-1', title: 'Записи лекций' });
      target.revision.visibility = 'FLOW';
      target.revision.flowId = 3201;
      target.revision.flowOptions = flowOptions;
      target.link.visibility = 'FLOW';
      target.link.flowId = 3201;
      target.link.audienceLabel = 'ФИЗ ПИИКТ 3.2.1';
      return moderationCase({ id: 'case-1', title: 'Записи лекций' }, {}, target);
    }

    function flows() {
      return within(detail()).getByRole('region', { name: /Потоки на выбор/ });
    }

    it('lists the options in their order with the chosen one marked', async () => {
      moderatorOnWideScreen();
      mockModeration([flowCase()]);

      renderApp('/admin/moderation');

      await openedCase('Математический анализ');
      const items = within(flows()).getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual([
        'ФИЗ ПИИКТ 3.2',
        'ФИЗ ПИИКТ 3.2.1Сейчас',
        'ФИЗ ПИИКТ 3.2.2',
      ]);
      expect(within(detail()).getByRole('region', { name: 'Ссылка' })).toHaveTextContent(
        'ФИЗ ПИИКТ 3.2.1',
      );
    });

    it('approves for another flow with a note, then names that flow in the history', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([flowCase(), second]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(
        within(flows()).getByRole('button', { name: 'Одобрить для другого потока' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Одобрить для другого потока' });
      const submit = within(dialog).getByRole('button', { name: 'Одобрить' });
      // The link's own flow is the plain approval, so the dialog waits for another one.
      expect(within(dialog).getByRole('combobox', { name: 'Поток' })).toHaveTextContent(
        'ФИЗ ПИИКТ 3.2.1',
      );
      expect(submit).toHaveAttribute('aria-disabled', 'true');
      await choose(dialog, 'Поток', 'ФИЗ ПИИКТ 3.2');
      await userEvent.type(
        within(dialog).getByRole('textbox', { name: /Комментарий/ }),
        'Записи нужны всему потоку',
      );
      await userEvent.click(submit);

      expect(await findToast('Ссылка одобрена для потока ФИЗ ПИИКТ 3.2')).toBeInTheDocument();
      expect(decisions.map((decision) => decision.body)).toEqual([
        { action: 'APPROVE', flowId: 3200, note: 'Записи нужны всему потоку' },
      ]);

      await openedCase('Физика');
      await userEvent.click(screen.getByRole('radio', { name: 'Решённые' }));
      expect(await openedCase('Математический анализ')).toBeInTheDocument();
      const log = within(detail()).getByRole('region', { name: 'Решения' });
      expect(log).toHaveTextContent('Одобрено для потока ФИЗ ПИИКТ 3.2');
      expect(log).toHaveTextContent('Записи нужны всему потоку');
      expect(within(detail()).getByRole('region', { name: 'Ссылка' })).toHaveTextContent(
        'ФИЗ ПИИКТ 3.2',
      );
    });

    it('sends only the flow when no note is written', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([flowCase()]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.click(screen.getByRole('button', { name: 'Одобрить для другого потока' }));
      const dialog = screen.getByRole('dialog', { name: 'Одобрить для другого потока' });
      await choose(dialog, 'Поток', 'ФИЗ ПИИКТ 3.2.2');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Одобрить' }));

      expect(await findToast('Ссылка одобрена для потока ФИЗ ПИИКТ 3.2.2')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'APPROVE', flowId: 3202 });
    });

    it('keeps the plain approval one click, without a flow', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([flowCase()]);
      renderApp('/admin/moderation');
      await openedCase('Математический анализ');

      await userEvent.keyboard('a');

      expect(await findToast('Ссылка одобрена')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'APPROVE' });
    });

    it.each([
      ['null', null],
      ['absent, from an older Backend', undefined],
    ])('shows no flows and offers no other flow when the options are %s', async (_, options) => {
      moderatorOnWideScreen();
      const item = flowCase();
      if (item.target?.targetType === 'SUBJECT_RESOURCE') {
        if (options === undefined) delete item.target.revision.flowOptions;
        else item.target.revision.flowOptions = options;
      }
      mockModeration([item]);

      renderApp('/admin/moderation');

      await openedCase('Математический анализ');
      expect(screen.getByRole('button', { name: 'Одобрить' })).toBeInTheDocument();
      expect(within(detail()).queryByRole('region', { name: /Потоки на выбор/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /другого потока/ })).toBeNull();
      expect(within(detail()).getByRole('region', { name: 'Ссылка' })).toHaveTextContent(
        'ФИЗ ПИИКТ 3.2.1',
      );
    });

    it('lists the flows of a closed case without offering to move it', async () => {
      moderatorOnWideScreen();
      const item = flowCase();
      mockModeration([
        {
          ...item,
          status: 'RESOLVED',
          decisions: [decisionOf('d1', 'APPROVE', { createdAt: minutesAgo(60), flowId: 3209 })],
        },
      ]);

      renderApp('/admin/moderation?status=RESOLVED');

      await openedCase('Математический анализ');
      expect(within(flows()).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /другого потока/ })).toBeNull();
      // A flow that is no longer among the options is named by its number.
      expect(within(detail()).getByRole('region', { name: 'Решения' })).toHaveTextContent(
        'Одобрено для потока № 3209',
      );
    });
  });
});
