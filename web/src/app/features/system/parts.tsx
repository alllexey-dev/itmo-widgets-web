// Building blocks of the system tabs: a state with its dot and the "where the value comes from"
// line of a setting.
import { HStack } from '@astryxdesign/core/Stack';
import { StatusDot, type StatusDotVariant } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { formatDateTime } from '../../lib/format';
import './system.css';

/** A state as a dot with its words; the dot alone never carries the meaning. */
export function State({ tone, label }: { tone: StatusDotVariant; label: string }) {
  return (
    <span className="system-state">
      <StatusDot variant={tone} label={label} />
      <Text type="body">{label}</Text>
    </span>
  );
}

/** Whether a setting was changed here or still is the server's default, and when it was changed. */
export function Origin({
  overridden,
  updatedAt,
}: {
  overridden: boolean;
  updatedAt: string | null;
}) {
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Token
        size="sm"
        color={overridden ? 'blue' : 'gray'}
        label={overridden ? 'Из настроек' : 'По умолчанию сервера'}
      />
      {updatedAt ? (
        <Text type="supporting" color="secondary">
          Изменено {formatDateTime(updatedAt)}
        </Text>
      ) : null}
    </HStack>
  );
}
