import { screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { minutesAgo, pageOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, userOf } from '../../test/server';
import type { AuditEntry } from './labels';

function entryOf(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: `entry-${overrides.action ?? 'ROLE_GRANTED'}`,
    action: 'ROLE_GRANTED',
    target: 'user:322222',
    details: 'role MODERATOR',
    createdAt: minutesAgo(5),
    actorIsu: 400001,
    actorName: 'Анна Смирнова',
    ...overrides,
  };
}

function mockAudit(entries: AuditEntry[]) {
  const pages: string[] = [];
  server.use(
    http.get('*/api/admin/audit', ({ request }) => {
      pages.push(new URL(request.url).searchParams.get('page') ?? '');
      return ok(pageOf(entries, request));
    }),
  );
  return pages;
}

async function rowOf(name: RegExp) {
  const table = await screen.findByRole('table', { name: 'Журнал' });
  return within(table).getByRole('row', { name });
}

describe('AuditPage', () => {
  it('shows who changed what with links to both users', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([entryOf({})]);

    renderApp('/admin/audit');

    const row = await rowOf(/Выдана роль/);
    expect(row).toHaveTextContent('role MODERATOR');
    expect(within(row).getByRole('link', { name: 'ИСУ 322222' })).toHaveAttribute(
      'href',
      '/app/admin/users/322222',
    );
    expect(within(row).getByRole('link', { name: 'Анна Смирнова' })).toHaveAttribute(
      'href',
      '/app/admin/users/400001',
    );
  });

  it.each([
    ['ROLE_REVOKED', 'user:322222', 'Снята роль', 'ИСУ 322222'],
    [
      'MODERATION_SETTINGS_CHANGED',
      'moderation-settings',
      'Правила модерации',
      'Настройки модерации',
    ],
    ['REVIEWS_SYNC_STARTED', 'reviews-sync', 'Синхронизация отзывов', 'Отзывы'],
    [
      'SERVICE_CREDENTIAL_REPLACED',
      'credential:ISU_KEYCLOAK_IDENTITY',
      'Замена учётных данных',
      'ИСУ · cookie KEYCLOAK_IDENTITY',
    ],
    [
      'SERVICE_CREDENTIAL_REPLACED',
      'credential:GEMINI_API_KEY',
      'Замена учётных данных',
      'Gemini · API-ключ',
    ],
    ['AI_SUMMARIES_RUN_STARTED', 'ai-summaries', 'Пересчёт ИИ-сводок', 'ИИ-сводки'],
    ['AI_SUMMARY_HIDDEN', 'teacher:123456', 'Сводка скрыта', 'Преподаватель · ИСУ 123456'],
    ['AI_SUMMARY_SHOWN', 'teacher:123456', 'Сводка показана', 'Преподаватель · ИСУ 123456'],
    [
      'AI_SUMMARY_REGENERATION_REQUESTED',
      'teacher:123456',
      'Пересчёт сводки',
      'Преподаватель · ИСУ 123456',
    ],
  ])('names %s on %s', async (action, target, actionLabel, targetLabel) => {
    mockSession(userOf(['ADMIN']));
    mockAudit([entryOf({ action, target, details: null })]);

    renderApp('/admin/audit');

    const row = await rowOf(new RegExp(actionLabel));
    expect(row).toHaveTextContent(targetLabel);
  });

  it.each([
    ['latest 2.1 -> 2.3', 'Android', 'latest 2.1 -> 2.3'],
    ['IOS: latest 1.0 -> 1.1', 'iOS', 'latest 1.0 -> 1.1'],
  ])('names the platform of the app version change %j', async (details, platform, rest) => {
    mockSession(userOf(['ADMIN']));
    mockAudit([entryOf({ action: 'APP_VERSION_CHANGED', target: 'app-version', details })]);

    renderApp('/admin/audit');

    const row = await rowOf(/Версия приложения/);
    expect(within(row).getByText(platform)).toBeInTheDocument();
    expect(within(row).getByText(rest)).toBeInTheDocument();
    expect(row).not.toHaveTextContent('IOS:');
  });

  it('shows an unknown action by its name', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([entryOf({ action: 'SOMETHING_NEW', target: 'thing', details: null })]);

    renderApp('/admin/audit');

    expect(await rowOf(/SOMETHING_NEW/)).toHaveTextContent('thing');
  });

  it('pages through older entries and keeps the page in the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const entries = Array.from({ length: 25 }, (_, index) =>
      entryOf({ id: `entry-${index}`, createdAt: minutesAgo(index * 60) }),
    );
    const pages = mockAudit(entries);
    renderApp('/admin/audit');
    expect(await screen.findByText('1–20 из 25')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Следующая страница' }));

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Журнал' })).getAllByRole('row')).toHaveLength(
      6,
    );
    expect(pages).toEqual(['0', '1']);
    expect(location.search).toBe('?page=1');
  });

  it('opens the page from the URL', async () => {
    mockSession(userOf(['ADMIN']));
    const entries = Array.from({ length: 25 }, (_, index) => entryOf({ id: `entry-${index}` }));
    const pages = mockAudit(entries);

    renderApp('/admin/audit?page=1');

    expect(await screen.findByText('21–25 из 25')).toBeInTheDocument();
    expect(pages).toEqual(['1']);
  });

  it('says when there are no entries', async () => {
    mockSession(userOf(['ADMIN']));
    mockAudit([]);

    renderApp('/admin/audit');

    expect(await screen.findByText('Записей пока нет')).toBeInTheDocument();
  });

  it('offers a retry after a failure', async () => {
    mockSession(userOf(['ADMIN']));
    let attempts = 0;
    server.use(
      http.get('*/api/admin/audit', ({ request }) => {
        attempts += 1;
        return attempts === 1
          ? fail(500, 'internal_server_error')
          : ok(pageOf([entryOf({})], request));
      }),
    );
    renderApp('/admin/audit');

    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

    expect(await rowOf(/Выдана роль/)).toBeInTheDocument();
  });
});
