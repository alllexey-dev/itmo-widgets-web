// One vocabulary for the ways a student waits for a sport lesson, shared by Главная and Спорт so the
// same queue is named the same on both pages.

/**
 * How a place on a lesson is being waited for:
 * - `auto`: an auto-sign entry made by the student for a lesson that is not published yet;
 * - `free`: a queue for a place that frees up on a published lesson;
 * - `section`: a lesson repeated every two weeks, for whose dates Backend queues by itself (its
 *   queue is an auto-sign entry the section opened).
 */
export type SportKind = 'auto' | 'free' | 'section';

/** The name of a kind, as a token on a row. */
export const SPORT_KIND_LABEL: Record<SportKind, string> = {
  auto: 'Автозапись',
  free: 'Очередь на место',
  section: 'Секция',
};

/** What a kind means, in one sentence for a student. */
export const SPORT_KIND_HINT: Record<SportKind, string> = {
  auto: 'Приложение запишет вас, как только откроется запись на занятие',
  free: 'Мест нет: приложение запишет вас, когда место освободится',
  section: 'Занятие раз в две недели: в очередь на каждую дату ставим вас автоматически',
};

/**
 * The kind of a queue entry: an auto-sign entry that a section opened ([sectionEntryIds] holds the
 * `entryId` of the sections' dates) belongs to the section, every other one is named by its type.
 */
export function sportKindOf(
  entry: { type: 'auto' | 'free'; id: number },
  sectionEntryIds: ReadonlySet<number>,
): SportKind {
  if (entry.type === 'free') return 'free';
  return sectionEntryIds.has(entry.id) ? 'section' : 'auto';
}
