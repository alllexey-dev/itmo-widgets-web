import { fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  linkTarget,
  minutesAgo,
  mockModeration,
  moderationCase,
  REVIEW_TEXT,
  reviewCase,
  reviewTarget,
  useWideScreen,
} from '../../test/moderation';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';

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

/** A moderator on a wide screen, where the first case opens by itself. */
function moderatorOnWideScreen() {
  mockSession(userOf(['MODERATOR']));
  useWideScreen();
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
    expect(await screen.findByRole('tab', { name: /Заявки/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Заявки/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists the shortcuts on a wide screen', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    expect(screen.getByText('следующая и предыдущая')).toBeInTheDocument();
    expect(screen.getByText('одобрить')).toBeInTheDocument();
    expect(screen.getByText('отклонить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Одобрить' })).toHaveAttribute(
      'aria-keyshortcuts',
      'A',
    );
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
    expect(screen.getByRole('button', { name: 'Жалобы' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(detail()).getByRole('button', { name: 'К списку' }));
    expect(within(await queue()).getAllByRole('button')).toHaveLength(2);
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
            {
              id: 'd1',
              moderatorId: null,
              action: 'APPROVE',
              note: null,
              restriction: null,
              createdAt: minutesAgo(600),
              actor: 'POLICY',
            },
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
    expect(screen.getByRole('list', { name: 'Заявки' })).toHaveTextContent('1 жалоб');
  });

  it('approves a case, moves on to the next one and refreshes the queue', async () => {
    moderatorOnWideScreen();
    const { decisions } = mockModeration([first, second]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    expect(await screen.findByText('Ссылка одобрена')).toBeInTheDocument();
    expect(decisions).toEqual([{ caseId: 'case-1', body: { action: 'APPROVE' }, csrf: '1' }]);
    expect(await openedCase('Физика')).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Заявки/ })).toHaveTextContent('1'));
  });

  it('hides a link and dismisses its reports', async () => {
    moderatorOnWideScreen();
    const target = linkTarget({ id: 'case-1', title: 'Чат потока' });
    target.reports = [{ reason: 'BROKEN', comment: null, createdAt: minutesAgo(5) }];
    const reported = moderationCase({ id: 'case-1', title: 'Чат потока' }, {}, target);
    const { decisions } = mockModeration([
      reported,
      moderationCase({ id: 'case-2', title: 'Второй чат' }, {}, { ...target }),
    ]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(await screen.findByText('Ссылка скрыта')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Отклонить жалобы' }));

    expect(await screen.findByText('Жалобы отклонены')).toBeInTheDocument();
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
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), '   ');
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Нет доступа');
    await userEvent.click(submit);

    expect(await screen.findByText('Ссылка отклонена')).toBeInTheDocument();
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
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Что запретить' }),
      'VOTE',
    );
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Срок' }),
      'forever',
    );
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Накрутка');
    await userEvent.click(submit);

    expect(await screen.findByText('Автор ограничен')).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть всё у автора' }));
    const dialog = screen.getByRole('dialog', { name: 'Скрыть все ссылки автора?' });
    const confirm = within(dialog).getByRole('button', { name: 'Скрыть всё' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Иван');
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox'), ' Петров');
    expect(decisions).toHaveLength(0);
    await userEvent.click(confirm);

    expect(await screen.findByText('Ссылки автора скрыты')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({ action: 'HIDE_ALL_BY_USER' });
  });

  it('says a case closed elsewhere is closed and shows its current state', async () => {
    moderatorOnWideScreen();
    const { state } = mockModeration([first]);
    renderApp('/admin/moderation');
    await openedCase('Математический анализ');
    state.set('case-1', { ...first, status: 'RESOLVED' });

    await userEvent.click(screen.getByRole('button', { name: 'Одобрить' }));

    expect(await screen.findByText('Заявка уже закрыта')).toBeInTheDocument();
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

    await fireEvent.keyDown(document.body, { code: 'KeyJ', key: 'о' });

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

    expect(await screen.findByText('Ссылка снова видна')).toBeInTheDocument();
    expect(decisions[0]?.body).toEqual({ action: 'RESTORE' });
  });

  it('links the author to the user card for administrators only', async () => {
    mockSession(userOf(['ADMIN']));
    useWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation');

    await openedCase('Математический анализ');
    expect(
      within(screen.getByRole('region', { name: 'Автор' })).getByRole('link', { name: 'Профиль' }),
    ).toHaveAttribute('href', '/app/admin/users/311111');
  });

  it('says when a case does not exist', async () => {
    moderatorOnWideScreen();
    mockModeration([first]);

    renderApp('/admin/moderation?case=missing');

    expect(await screen.findByText('Заявка не найдена')).toBeInTheDocument();
  });

  describe('teacher reviews', () => {
    const review = reviewCase({ id: 'review-1' });
    const reviewTitle = 'Сергей Кузнецов · ИСУ 123456';

    it('lists a review with the teacher ISU, the subject and the start of the text', async () => {
      mockSession(userOf(['MODERATOR']));
      mockModeration([review]);

      renderApp('/admin/moderation');

      const row = within(await queue()).getByRole('button');
      expect(row).toHaveTextContent('ИСУ 123456 · Математический анализ');
      expect(row).toHaveTextContent('Объясняет понятно, на консультациях');
    });

    it('shows the author of an anonymous review, the teacher and the ISU check', async () => {
      moderatorOnWideScreen();
      mockModeration([review]);

      renderApp('/admin/moderation');

      expect(await openedCase(reviewTitle)).toBeInTheDocument();
      const preview = within(detail()).getByRole('region', { name: 'Отзыв' });
      expect(preview).toHaveTextContent('Анонимно');
      expect(preview).toHaveTextContent('Проверяется');
      expect(preview).toHaveTextContent(REVIEW_TEXT);
      const author = within(detail()).getByRole('region', { name: 'Автор' });
      expect(author).toHaveTextContent('Иван Петров');
      expect(author).toHaveTextContent('ИСУ 311111');
      expect(within(author).queryByRole('link', { name: 'Профиль' })).not.toBeInTheDocument();
    });

    it('names the teacher by ISU when My ITMO does not know the name', async () => {
      moderatorOnWideScreen();
      mockModeration([reviewCase({ id: 'review-1', teacherName: null })]);

      renderApp('/admin/moderation');

      expect(await openedCase('Преподаватель · ИСУ 123456')).toBeInTheDocument();
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

      expect(await screen.findByText('Отзыв одобрен')).toBeInTheDocument();
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

      expect(await screen.findByText('Отзыв отклонён')).toBeInTheDocument();
      expect(decisions[0]?.body).toEqual({ action: 'REJECT', note: 'Личные данные' });
    });

    it('restricts writing reviews by default', async () => {
      moderatorOnWideScreen();
      const { decisions } = mockModeration([review]);
      renderApp('/admin/moderation');
      await openedCase(reviewTitle);

      await userEvent.click(screen.getByRole('button', { name: 'Ограничить' }));
      const dialog = screen.getByRole('dialog', { name: 'Ограничить автора' });
      expect(within(dialog).getByRole('combobox', { name: 'Что запретить' })).toHaveDisplayValue(
        'Отзывы',
      );
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Причина' }), 'Оскорбления');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Ограничить' }));

      expect(await screen.findByText('Автор ограничен')).toBeInTheDocument();
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

      await userEvent.click(screen.getByRole('button', { name: 'Скрыть всё у автора' }));
      const dialog = screen.getByRole('dialog', { name: 'Скрыть все отзывы автора?' });
      expect(dialog).toHaveTextContent(
        'Опубликованные отзывы Иван Петров скроются, отзывы на проверке будут отклонены.',
      );
      await userEvent.type(within(dialog).getByRole('textbox'), 'Иван Петров{Enter}');

      expect(await screen.findByText('Отзывы автора скрыты')).toBeInTheDocument();
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

  it('says so when the queue is empty', async () => {
    moderatorOnWideScreen();
    mockModeration([]);

    renderApp('/admin/moderation');

    expect(await screen.findByText('Очередь пуста')).toBeInTheDocument();
    expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument();
  });
});
