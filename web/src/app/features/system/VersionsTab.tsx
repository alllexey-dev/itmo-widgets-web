import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApiMutation, useApiQuery, type Resource } from '../../lib/data';
import { counted, formatNumber } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { UNKNOWN_VERSION } from '../../lib/metricLabels';
import { Panel } from '../../lib/Panel';
import { useQueryState } from '../../lib/router';
import { Stat, Stats } from '../../lib/Stats';
import {
  AUDIT_PREFIX,
  CLIENT_VERSIONS_PATH,
  saveVersion,
  STATISTICS_HREF,
  VERSION_PATH,
} from './api';
import { PLATFORM_NAMES, PLATFORMS } from './labels';
import { Origin } from './parts';
import type { AppVersion, ClientVersions, Platform } from './types';
import { compareVersions, isVersion, NOTE_LIMIT, versionError } from './version';

const DEVICES = ['устройство', 'устройства', 'устройств'] as const;
const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 });

/**
 * Версии: what the app is told to update to, per platform, next to how many devices the typed
 * versions leave behind. The versions in use themselves are a statistic and live in Статистика.
 */
export function VersionsTab() {
  const [query, setQuery] = useQueryState({ platform: 'ANDROID' });
  const platform: Platform = query.platform === 'IOS' ? 'IOS' : 'ANDROID';
  // Android and iOS are edited apart; the other platform loads when it is picked.
  const version = useApiQuery<AppVersion>(VERSION_PATH, { platform });
  const inUse = useApiQuery<ClientVersions>(CLIENT_VERSIONS_PATH);

  return (
    <Panel
      body="content"
      title="Версия приложения"
      hint="Приложение предлагает обновиться до последней версии и требует минимальную"
      action={
        <SegmentedControl
          label="Платформа"
          size="sm"
          value={platform}
          onChange={(next) => setQuery({ platform: next })}
        >
          {PLATFORMS.map((value) => (
            <SegmentedControlItem key={value} value={value} label={PLATFORM_NAMES[value]} />
          ))}
        </SegmentedControl>
      }
    >
      <Loadable
        resource={version}
        label="Загружаем версию"
        errorTitle="Не удалось загрузить версию"
        isCompact
      >
        {(saved) => (
          // The form starts over when the saved values change: after a save or on the other platform.
          <VersionForm
            key={[platform, saved.latest, saved.minimum, saved.note, saved.updatedAt].join('|')}
            platform={platform}
            saved={saved}
            inUse={inUse}
          />
        )}
      </Loadable>
    </Panel>
  );
}

/** Devices of the platform active in 30 days: all of them, and those on a version below `version`. */
function devicesOf(versions: ClientVersions, platform: Platform) {
  const builds = versions.last30d.builds.filter((build) => build.platform === platform);
  const count = (list: typeof builds) => list.reduce((sum, build) => sum + build.devices, 0);
  return {
    total: count(builds),
    below: (version: string) =>
      count(builds.filter((build) => compareVersions(build.version, version) < 0)),
  };
}

function VersionForm({
  platform,
  saved,
  inUse,
}: {
  platform: Platform;
  saved: AppVersion;
  inUse: Resource<ClientVersions>;
}) {
  const [latest, setLatest] = useState(saved.latest);
  const [minimum, setMinimum] = useState(saved.minimum);
  const [note, setNote] = useState(saved.note);
  const [isConfirming, setIsConfirming] = useState(false);

  const latestError = versionError(latest);
  const minimumError =
    versionError(minimum) ??
    (!latestError && compareVersions(minimum, latest) > 0 ? 'Не выше последней' : undefined);
  const noteError =
    note.trim().length > NOTE_LIMIT ? `Не больше ${NOTE_LIMIT} символов` : undefined;
  const isDirty =
    latest.trim() !== saved.latest ||
    minimum.trim() !== saved.minimum ||
    note.trim() !== saved.note;
  const isValid = !latestError && !minimumError && !noteError;
  const raisesMinimum = isValid && compareVersions(minimum, saved.minimum) > 0;

  const save = useApiMutation({
    run: () =>
      saveVersion(platform, { latest: latest.trim(), minimum: minimum.trim(), note: note.trim() }),
    forgets: [VERSION_PATH, AUDIT_PREFIX],
    done: 'Версия сохранена',
    failed: 'Не удалось сохранить версию',
    errors: {
      invalid_request_data: 'Проверьте версии и заметку',
      invalid_request: 'Проверьте версии и заметку',
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isDirty || !isValid || save.isPending) return;
    if (raisesMinimum) setIsConfirming(true);
    else save.mutate();
  }

  function reset() {
    setLatest(saved.latest);
    setMinimum(saved.minimum);
    setNote(saved.note);
  }

  const below = inUse.data ? devicesOf(inUse.data, platform).below(minimum.trim()) : null;
  const error = (message: string | undefined) =>
    message ? ({ type: 'error', message } as const) : undefined;

  return (
    <div className="system-columns">
      <form className="system-form" onSubmit={submit} noValidate>
        <div className="system-fields">
          <TextInput
            label="Последняя"
            value={latest}
            onChange={setLatest}
            status={isDirty ? error(latestError) : undefined}
            autoComplete="off"
            hasSpellCheck={false}
          />
          <TextInput
            label="Минимальная"
            value={minimum}
            onChange={setMinimum}
            status={isDirty ? error(minimumError) : undefined}
            autoComplete="off"
            hasSpellCheck={false}
          />
        </div>
        <TextArea
          label="Что нового"
          description="Видно в приложении рядом с предложением обновиться"
          rows={3}
          value={note}
          onChange={setNote}
          maxLength={NOTE_LIMIT}
          status={error(noteError)}
        />
        <Origin overridden={saved.overridden} updatedAt={saved.updatedAt} />
        <HStack gap={2} wrap="wrap">
          <Button
            label="Сохранить"
            variant="primary"
            type="submit"
            isDisabled={!isDirty}
            isLoading={save.isPending}
          />
          {isDirty ? (
            <Button label="Отменить" variant="ghost" onClick={reset} isDisabled={save.isPending} />
          ) : null}
        </HStack>
      </form>
      <Reach platform={platform} minimum={minimum} latest={latest} inUse={inUse} />
      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title={`Поднять минимальную версию до ${minimum.trim()}?`}
        description={[
          `Приложение для ${PLATFORM_NAMES[platform]} ниже версии ${minimum.trim()} начнёт просить обновление при каждом запуске, без «Пропустить версию».`,
          below === null
            ? ''
            : below > 0
              ? `За 30 дней на более старых версиях было активно ${counted(below, DEVICES)}.`
              : 'За 30 дней активных устройств на более старых версиях не было.',
        ]
          .filter(Boolean)
          .join(' ')}
        actionLabel="Поднять"
        cancelLabel="Отмена"
        actionVariant="primary"
        onAction={() => {
          setIsConfirming(false);
          save.mutate();
        }}
      />
    </div>
  );
}

/**
 * Whom the versions in the fields reach: devices of the platform active in 30 days that run
 * something older. It follows what is typed, so the answer is there before a save.
 */
function Reach({
  platform,
  minimum,
  latest,
  inUse,
}: {
  platform: Platform;
  minimum: string;
  latest: string;
  inUse: Resource<ClientVersions>;
}) {
  return (
    <VStack as="section" gap={3} aria-label="Кого это затронет">
      <VStack gap={0.5}>
        <Text type="label" weight="semibold">
          Кого это затронет
        </Text>
        <Text type="supporting" color="secondary">
          Устройства {PLATFORM_NAMES[platform]}, активные за 30 дней, по версиям в полях
        </Text>
      </VStack>
      <Loadable
        resource={inUse}
        label="Загружаем устройства"
        errorTitle="Не удалось загрузить устройства"
        isCompact
      >
        {(versions) => {
          const devices = devicesOf(versions, platform);
          const below = (version: string) => {
            if (!isVersion(version)) return { value: '—' };
            const count = devices.below(version.trim());
            return {
              value: formatNumber(count),
              note:
                devices.total > 0
                  ? `${percent.format(count / devices.total)} из ${formatNumber(devices.total)}`
                  : undefined,
            };
          };
          return (
            <Stats>
              <Stat label="Ниже минимальной" {...below(minimum)} />
              <Stat label="Ниже последней" {...below(latest)} />
              {platform === 'ANDROID' ? (
                <Stat
                  label={UNKNOWN_VERSION.label}
                  value={formatNumber(versions.last30d.unknownDevices)}
                  note={UNKNOWN_VERSION.note}
                />
              ) : null}
            </Stats>
          );
        }}
      </Loadable>
      <HStack>
        <Button
          label="Версии и сборки в статистике"
          href={STATISTICS_HREF}
          variant="secondary"
          size="sm"
          endContent={<ArrowRight size={16} />}
        />
      </HStack>
    </VStack>
  );
}
