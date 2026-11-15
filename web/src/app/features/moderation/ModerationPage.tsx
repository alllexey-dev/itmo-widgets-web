import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Kbd } from '@astryxdesign/core/Kbd';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack } from '@astryxdesign/core/Stack';
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton';
import { CircleCheckBig, Gavel, Inbox } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { PageHeader } from '../../lib/PageHeader';
import { Pagination } from '../../lib/Pagination';
import { useQueryState } from '../../lib/router';
import { casePath, CASES_PATH, QUEUE_PAGE_SIZE } from './api';
import { CaseDetail } from './CaseDetail';
import { CaseList } from './CaseList';
import { REASONS } from './labels';
import './moderation.css';
import { useRevert, type RevertRequest } from './revert';
import { releasePointerFocus, useShortcuts } from './shortcuts';
import type { AdminCaseItem, AdminPage, CaseReason, CaseStatus, ModerationCase } from './types';
import { useWide } from './useWide';

const ALL = 'ALL';
/** The phone breakpoint of the cabinet (`cabinet.css`, `moderation.css`). */
const PHONE = '(max-width: 640px)';
const REASON_VALUES = Object.keys(REASONS) as CaseReason[];

function reasonOf(value: string): CaseReason | null {
  return REASON_VALUES.find((reason) => reason === value) ?? null;
}

/**
 * The keys that move through the queue, in the page header. The keys that decide are on the
 * buttons of the open case, so each names what it does to that case.
 */
function ShortcutHints() {
  return (
    <p className="mod-hints">
      <span>
        <Kbd keys="J" />
        <Kbd keys="K" />
        следующая и предыдущая
      </span>
    </p>
  );
}

const STATUSES: readonly CaseStatus[] = ['OPEN', 'RESOLVED', 'WITHDRAWN'];

function statusOf(value: string): CaseStatus {
  return STATUSES.find((status) => status === value) ?? 'OPEN';
}

/** The order Backend lists cases in, said next to the filters. */
const ORDER: Record<CaseStatus, string> = {
  OPEN: 'Сначала те, что ждут дольше',
  RESOLVED: 'Сначала решённые недавно',
  WITHDRAWN: 'Сначала отозванные недавно',
};

/**
 * The case the moderator chose, ahead of the address. `from` is the case the address named when
 * the choice was made: the choice steps aside once the address has moved. A choice made by paging
 * with a key instead waits for `untilPage` to arrive and then gives way to a case of that page.
 */
interface Choice {
  id: string | null;
  from: string | null;
  untilPage?: number;
  then?: 'first' | 'last';
}

interface QueueProps {
  status: CaseStatus;
  reason: CaseReason | null;
  page: number;
  /** The case named in the address; without one a wide screen opens the first of the queue. */
  requestedId: string | null;
  wide: boolean;
  onSelect: (id: string | null) => void;
  onPage: (page: number) => void;
}

/**
 * The queue and the open case under one filter. The page mounts a new one per filter, so cases of
 * the previous filter are never shown, selected or decided under the new one.
 */
function Queue({ status, reason, page, requestedId, wide, onSelect, onPage }: QueueProps) {
  const cases = useApiQuery<AdminPage<AdminCaseItem>>(CASES_PATH, {
    status,
    reason,
    page,
    size: QUEUE_PAGE_SIZE,
  });
  const items = cases.data?.items ?? [];

  // The address changes a moment after a key or a click (the router treats it as a transition), so
  // the choice itself is kept here and shown at once; it steps aside when the address has moved.
  const [chosen, setChosen] = useState<Choice | null>(null);
  if (chosen?.untilPage !== undefined) {
    if (page === chosen.untilPage && cases.data?.page === chosen.untilPage) {
      // The page a key asked for is here: K came from the page after it and lands on its last
      // case, J on the first. A narrow screen has no case open by itself, so it gets one too.
      const landing = chosen.then === 'last' ? items.at(-1) : wide ? undefined : items[0];
      setChosen(landing ? { id: landing.id, from: requestedId } : null);
    }
  } else if (chosen && chosen.from !== requestedId) {
    setChosen(null);
  }
  const selectedId = chosen ? chosen.id : (requestedId ?? (wide ? (items[0]?.id ?? null) : null));
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const nextId = items[selectedIndex + 1]?.id ?? null;

  // Warms the next case of the queue, so J and the move after a decision open it at once.
  useApiQuery<ModerationCase>(nextId ? casePath(nextId) : null);

  // Keys can come faster than renders, and a decision arrives when its request ends, by which time
  // the moderator may have moved on: both read the queue and the selection as they are now.
  const shown = {
    items,
    selectedId,
    page: cases.data?.page ?? page,
    total: cases.data?.total ?? 0,
  };
  const now = useRef(shown);
  useEffect(() => {
    now.current = shown;
  });

  function select(id: string | null) {
    now.current = { ...now.current, selectedId: id };
    setChosen(id === requestedId ? null : { id, from: requestedId });
    onSelect(id);
  }

  /** J past the last case of a page and K before the first go on to the neighbouring page. */
  function turnPage(step: 1 | -1) {
    const { selectedId: current, page: shownPage, total } = now.current;
    const target = shownPage + step;
    if (target < 0 || target * QUEUE_PAGE_SIZE >= total) return;
    // The open case stays on screen until the page arrives.
    setChosen({ id: current, from: null, untilPage: target, then: step < 0 ? 'last' : 'first' });
    onPage(target);
  }

  function move(step: 1 | -1) {
    const { items: queue, selectedId: current } = now.current;
    const index = queue.findIndex((item) => item.id === current);
    const target = queue[index < 0 ? 0 : index + step];
    if (target) select(target.id);
    else if (index >= 0) turnPage(step);
  }
  useShortcuts(items.length > 0 ? { KeyJ: () => move(1), KeyK: () => move(-1) } : {});

  /** A resolved case leaves the open queue: go on to its neighbour. */
  function decided(updated: ModerationCase) {
    const { items: queue, selectedId: current } = now.current;
    if (status !== 'OPEN' || updated.status === 'OPEN' || current !== updated.id) return;
    const index = queue.findIndex((item) => item.id === updated.id);
    const neighbour = index < 0 ? null : (queue[index + 1] ?? queue[index - 1] ?? null);
    select(neighbour?.id ?? null);
  }

  /** Backend refused a decision: the case stays open here even when it has left the queue. */
  function refused(id: string) {
    if (now.current.selectedId === id) select(id);
  }

  // An undo from a toast lands after the case has gone; this queue may be gone by then too.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const revert = useRevert();

  /**
   * Takes a decision back and opens its case again, back in its place. Only if the moderator has
   * not moved on since the click: a key meant for the case on screen must not land on another one.
   */
  function undo(request: RevertRequest) {
    if (revert.pendingId) return;
    const from = now.current.selectedId;
    void revert.run(request).then((updated) => {
      if (updated && alive.current && now.current.selectedId === from) select(updated.id);
    });
  }

  const empty = cases.data !== undefined && items.length === 0;
  // The last case of a later page was decided: the queue continues on the page before it.
  const pageRanOut = empty && page > 0 && cases.data?.page === page && !cases.loading;
  useEffect(() => {
    if (pageRanOut) onPage(page - 1);
  }, [pageRanOut, page, onPage]);
  const emptyTexts = reason
    ? {
        icon: Inbox,
        title: 'Заявок с такой причиной нет',
        text: 'Остальные заявки — под фильтром «Все».',
      }
    : status === 'OPEN'
      ? { icon: CircleCheckBig, title: 'Очередь пуста', text: 'Новые заявки появятся здесь.' }
      : status === 'RESOLVED'
        ? { icon: Inbox, title: 'Решённых заявок нет', text: undefined }
        : {
            icon: Inbox,
            title: 'Отозванных заявок нет',
            text: 'Сюда попадают заявки, закрытые без решения: автор отозвал версию или модератор скрыл всё у автора.',
          };
  const emptyState = (
    <EmptyState
      icon={<emptyTexts.icon size={32} />}
      title={emptyTexts.title}
      description={emptyTexts.text}
      headingLevel={2}
      isCompact={selectedId !== null}
    />
  );

  // Nothing in the queue and nothing asked for: one message instead of two empty panes.
  if (empty && !selectedId) return <Card padding={5}>{emptyState}</Card>;

  return (
    <div className="mod-layout">
      <section className="mod-queue" aria-label="Очередь" hidden={!wide && selectedId !== null}>
        <Card padding={0} className="mod-scroll">
          <Loadable
            resource={cases}
            label="Загружаем заявки"
            errorTitle="Не удалось загрузить заявки"
            isCompact
          >
            {(data) =>
              data.items.length === 0 ? (
                emptyState
              ) : (
                <>
                  <CaseList items={data.items} selectedId={selectedId} onSelect={select} />
                  <Pagination
                    page={data.page}
                    size={data.size}
                    total={data.total}
                    onChange={onPage}
                  />
                </>
              )
            }
          </Loadable>
        </Card>
      </section>

      {wide || selectedId ? (
        <section className="mod-pane" aria-label="Заявка">
          <Card padding={5} className="mod-scroll">
            {selectedId ? (
              <CaseDetail
                key={selectedId}
                caseId={selectedId}
                onBack={wide ? undefined : () => select(null)}
                onDecided={decided}
                onRefused={() => refused(selectedId)}
                hasKeys={wide}
                row={items.find((item) => item.id === selectedId)}
                onUndo={undo}
                revertingId={revert.pendingId}
              />
            ) : (
              <EmptyState icon={<Gavel size={32} />} title="Выберите заявку" headingLevel={2} />
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/**
 * `/admin/moderation`: the queue of cases about subject links and teacher reviews, and the open case.
 * `status`, `reason`, `page` and `case` live in the query string. A wide screen shows the queue and
 * the case side by side and opens the first case by itself; a phone shows the queue first and a case
 * in its place.
 */
export default function ModerationPage() {
  const wide = useWide();
  const isPhone = useMediaQuery(PHONE);
  const [query, setQuery] = useQueryState({ status: 'OPEN', reason: '', page: 0, case: '' });
  const status = statusOf(query.status);
  const reason = reasonOf(query.reason);
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 0;

  return (
    <VStack gap={6} className="mod-page" data-wide={wide}>
      <PageHeader
        title="Очередь модерации"
        text="Новые ссылки и отзывы, жалобы и низкий рейтинг"
        actions={wide ? <ShortcutHints /> : undefined}
      />
      <div className="mod-body">
        {/* On a phone an open case has the screen to itself; the filters come back with the queue. */}
        <div
          className="mod-toolbar"
          hidden={!wide && query.case !== ''}
          onClick={releasePointerFocus}
        >
          <SegmentedControl
            label="Состояние заявок"
            value={status}
            onChange={(value) => setQuery({ status: value, page: null, case: null })}
          >
            <SegmentedControlItem value="OPEN" label="Открытые" />
            <SegmentedControlItem value="RESOLVED" label="Решённые" />
            <SegmentedControlItem value="WITHDRAWN" label="Отозванные" />
          </SegmentedControl>
          <ToggleButtonGroup
            label="Причина"
            className="mod-presets"
            value={reason ?? ALL}
            onChange={(value) =>
              setQuery({ reason: value === ALL ? null : value, page: null, case: null })
            }
          >
            <ToggleButton value={ALL} label="Все" />
            {REASON_VALUES.map((value) => (
              <ToggleButton key={value} value={value} label={REASONS[value].label}>
                {/* A phone has room for one row of filters only with the short names. */}
                {isPhone ? REASONS[value].mark : undefined}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <span className="mod-order">{ORDER[status]}</span>
        </div>
        {status === 'WITHDRAWN' ? (
          <p className="mod-muted mod-tab-hint" hidden={!wide && query.case !== ''}>
            Закрыты без решения модератора по ним: автор отозвал версию, или её отклонили, когда
            скрывали всё у автора.
          </p>
        ) : null}
        <Queue
          key={`${status}:${reason ?? ALL}`}
          status={status}
          reason={reason}
          page={page}
          requestedId={query.case || null}
          wide={wide}
          onSelect={(id) => setQuery({ case: id })}
          onPage={(next) => setQuery({ page: next, case: null })}
        />
      </div>
    </VStack>
  );
}
