import { describe, expect, it } from 'vitest';
import { CATEGORIES, REPORT_REASONS, visibilityLabel } from '../features/moderation/labels';
import app from './fixtures/app-labels.json';

// Registry IDs correspond to LinkCategory.iconRes() at the recorded app SHA.
const MAPPING = {
  categories: {
    SCORES: ['links_category_scores', 'table'],
    QUEUE: ['links_category_queue', 'format_list_numbered'],
    MATERIALS: ['links_category_materials', 'folder'],
    TASKS: ['links_category_tasks', 'assignment'],
    RECORDINGS: ['links_category_recordings', 'videocam'],
    NOTES: ['links_category_notes', 'edit_note'],
    EXAM: ['links_category_exam', 'school'],
    CHAT: ['links_category_chat', 'chat'],
    OTHER: ['links_category_other', 'link'],
  },
  reports: {
    BROKEN: 'links_report_broken',
    WRONG_SUBJECT: 'links_report_wrong_subject',
    SPAM: 'links_report_spam',
    OTHER: 'links_report_other',
  },
  visibility: {
    PRIVATE: 'links_visibility_private',
    FLOW: 'links_visibility_flow_unnamed',
    ALL: 'links_visibility_all',
  },
} as const;

const INTENTIONAL = [
  {
    key: 'PRIVATE',
    label: 'Только автор',
    reason: 'Moderators view another author, while the app says Только я.',
  },
  { key: 'OFFENSIVE', label: 'Оскорбления', reason: 'Moderator reason without an app string.' },
  {
    key: 'WRONG_TEACHER',
    label: 'Не тот преподаватель',
    reason: 'Moderator reason without an app string.',
  },
] as const;

const strings: Record<string, string> = app.strings;
const icons: Record<string, string> = app.icons;

describe('app label drift', () => {
  it('records an immutable app source', () => {
    expect(app.appSha).toMatch(/^[a-f0-9]{40}$/);
  });

  it('covers every category and matches its resource and registry symbol', () => {
    expect(Object.keys(CATEGORIES).sort()).toEqual(Object.keys(MAPPING.categories).sort());
    for (const [category, [resource, icon]] of Object.entries(MAPPING.categories)) {
      const actual = CATEGORIES[category as keyof typeof CATEGORIES];
      expect(strings[resource], resource).toBeDefined();
      expect(icons[icon], icon).toBeDefined();
      expect(actual.label, category).toBe(strings[resource]);
      expect(actual.icon, category).toBe(icons[icon]);
    }
  });

  it('covers report reasons with explicit moderator exceptions', () => {
    const exceptions = INTENTIONAL.filter((entry) => entry.key !== 'PRIVATE');
    expect(Object.keys(REPORT_REASONS).sort()).toEqual(
      [...Object.keys(MAPPING.reports), ...exceptions.map((entry) => entry.key)].sort(),
    );
    for (const [reason, resource] of Object.entries(MAPPING.reports)) {
      expect(strings[resource], resource).toBeDefined();
      expect(REPORT_REASONS[reason as keyof typeof REPORT_REASONS], reason).toBe(strings[resource]);
    }
    for (const entry of exceptions) {
      expect(entry.reason).not.toBe('');
      expect(strings[`links_report_${entry.key.toLowerCase()}`]).toBeUndefined();
      expect(REPORT_REASONS[entry.key]).toBe(entry.label);
    }
  });

  it('matches visibility fallbacks and keeps intentional author wording', () => {
    for (const [visibility, resource] of Object.entries(MAPPING.visibility)) {
      expect(strings[resource], resource).toBeDefined();
      const exception = INTENTIONAL.find((entry) => entry.key === visibility);
      expect(visibilityLabel(visibility as keyof typeof MAPPING.visibility, null)).toBe(
        exception?.label ?? strings[resource],
      );
    }
    expect(strings.links_visibility_private).toBe('Только я');
  });

  it('uses a supplied flow audience instead of its fallback', () => {
    expect(visibilityLabel('FLOW', 'Synthetic flow')).toBe('Synthetic flow');
  });
});
