import { Button } from '@astryxdesign/core/Button';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { DateInput } from '@astryxdesign/core/DateInput';
import { Selector, type SelectorOptionType } from '@astryxdesign/core/Selector';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import type { ISODateString } from '@astryxdesign/core/Calendar';
import { useApiQuery } from '../../lib/data';
import { counted, formatDate } from '../../lib/format';
import { moscowToday, type AuditFilters } from './filters';
import { ACTION_GROUPS, actionOf, nameOrFallback, TARGET_TYPES, targetLabel } from './labels';
import type { AuditEntry, StaffPage } from './types';

/**
 * Who can be in the log: only administrators change what it records, and there are a few of them.
 * Backend pages at most 100.
 */
const STAFF_PATH = '/api/admin/users';
const STAFF_QUERY = { role: 'ADMIN', page: 0, size: 100 };

const PHONE = '(max-width: 640px)';

const ACTION_OPTIONS: SelectorOptionType[] = ACTION_GROUPS.map((group) => ({
  type: 'section',
  title: group.title,
  options: group.actions.map((action) => ({ value: action, label: actionOf(action).label })),
}));

interface ClauseProps {
  /** The name of the field: the closed trigger shows it unset and "Кто: Анна Смирнова" once set. */
  label: string;
  value: string;
  options: SelectorOptionType[];
  onChange: (value: string | null) => void;
  /** A phone sets the width of the bar's cell. */
  width?: string;
}

/** One filter of the bar: a closed trigger that reads as the whole clause once it is set. */
function Clause({ label, value, options, onChange, width }: ClauseProps) {
  return (
    <Selector
      label={label}
      isLabelHidden
      placeholder={label}
      hasClear
      value={value || null}
      options={options}
      controlClassName={value ? 'audit-filter-set' : undefined}
      renderValue={(option) => `${label}: ${option.label ?? option.value}`}
      width={width}
      onChange={onChange}
    />
  );
}

interface DayProps {
  label: string;
  /** The word before the date once one is chosen: "с 1 мар.", "по 5 мар.". */
  prefix: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string | null) => void;
  width?: string;
}

function Day({ label, prefix, value, min, max, onChange, width }: DayProps) {
  return (
    <DateInput
      label={label}
      isLabelHidden
      placeholder={label}
      hasClear
      weekStartsOn="mon"
      value={(value || undefined) as ISODateString | undefined}
      min={(min || undefined) as ISODateString | undefined}
      max={(max || undefined) as ISODateString | undefined}
      format={(day) => `${prefix} ${formatDate(day)}`}
      controlClassName={value ? 'audit-filter-set' : undefined}
      width={width ?? 168}
      onChange={(day) => onChange(day ?? null)}
    />
  );
}

interface BarProps {
  filters: AuditFilters;
  /** The entries on screen: they name the administrator and the target of the filters. */
  entries: readonly AuditEntry[];
  /** The number of entries that match, once it is known. */
  total: number | undefined;
  onChange: (patch: Partial<Record<keyof AuditFilters, string | null>>) => void;
  onClear: () => void;
}

/** The filters above the log: who, what and when, each kept in the address. */
export function AuditFilterBar({ filters, entries, total, onChange, onClear }: BarProps) {
  const staff = useApiQuery<StaffPage>(STAFF_PATH, STAFF_QUERY);
  const actors = [...(staff.data?.items ?? [])]
    .map((user) => ({ value: String(user.isu), label: nameOrFallback(user.name) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  // An administrator who is one no longer, or a link from somewhere else: the log still names them.
  if (filters.actorIsu && !actors.some((actor) => actor.value === filters.actorIsu)) {
    const entry = entries.find((item) => String(item.actorIsu) === filters.actorIsu);
    actors.unshift({
      value: filters.actorIsu,
      label: entry ? nameOrFallback(entry.actorName) : `ИСУ ${filters.actorIsu}`,
    });
  }
  const targetName = entries.find((entry) => entry.target === filters.target)?.targetName ?? null;
  const isFiltered = Object.values(filters).some(Boolean);
  const today = moscowToday();
  // A phone gives every filter the width of the page (`audit.css`).
  const width = useMediaQuery(PHONE) ? '100%' : undefined;

  return (
    <div className="audit-filters">
      <Clause
        label="Кто"
        value={filters.actorIsu}
        options={actors}
        onChange={(actorIsu) => onChange({ actorIsu })}
        width={width}
      />
      <Clause
        label="Действие"
        value={filters.action}
        options={ACTION_OPTIONS}
        onChange={(action) => onChange({ action })}
        width={width}
      />
      {filters.target ? (
        // One target comes from a link (a user's card); it is more precise than the kind.
        <Token
          size="lg"
          label={`Объект: ${targetLabel(filters.target, targetName)}`}
          onRemove={() => onChange({ target: null })}
        />
      ) : (
        <Clause
          label="Объект"
          value={filters.targetType}
          options={[...TARGET_TYPES]}
          onChange={(targetType) => onChange({ targetType })}
          width={width}
        />
      )}
      <Day
        label="С какого дня"
        prefix="с"
        value={filters.from}
        max={filters.to || today}
        onChange={(from) => onChange({ from })}
        width={width}
      />
      <Day
        label="По какой день"
        prefix="по"
        value={filters.to}
        min={filters.from}
        max={today}
        onChange={(to) => onChange({ to })}
        width={width}
      />
      <HStack gap={2} vAlign="center">
        {isFiltered ? <Button label="Сбросить" variant="ghost" onClick={onClear} /> : null}
        {total !== undefined ? (
          <Text color="secondary" aria-live="polite">
            {counted(total, ['запись', 'записи', 'записей'])}
          </Text>
        ) : null}
      </HStack>
    </div>
  );
}
