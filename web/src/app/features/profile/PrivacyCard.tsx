import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useId, useRef, useState } from 'react';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { PRIVACY_PATH, savePrivacy } from './api';
import { AUDIENCE_ROWS, AUDIENCES } from './labels';
import './profile.css';
import type { Audience, PrivacySettings } from './types';

type Key = keyof PrivacySettings;

/**
 * "Кто видит": three audiences, each saved at once with all three in the PUT. The choice shows
 * before Backend answers; a failed save puts the saved one back.
 */
export function PrivacyCard() {
  const settings = useApiQuery<PrivacySettings>(PRIVACY_PATH);
  const titleId = useId();
  // Choices on their way to Backend, over the saved settings; `turn` tells them apart.
  const [chosen, setChosen] = useState<Partial<Record<Key, { value: Audience; turn: number }>>>({});
  const turns = useRef(0);
  const save = useApiMutation({
    run: savePrivacy,
    forgets: [PRIVACY_PATH],
    done: 'Настройка сохранена',
    failed: 'Не удалось сохранить настройку',
  });

  // Saves go one at a time: every PUT carries all three audiences, so two in flight could land
  // in the wrong order and drop the later choice. A queued save builds on the answer to the one
  // before it, so a choice that failed is not saved along with the next.
  const queue = useRef<Promise<PrivacySettings | null>>(Promise.resolve(null));

  function choose(saved: PrivacySettings, key: Key, value: Audience) {
    turns.current += 1;
    const turn = turns.current;
    setChosen((current) => ({ ...current, [key]: { value, turn } }));
    queue.current = queue.current.then(async (answered) => {
      let known = answered;
      try {
        known = await save.mutateAsync({ ...(answered ?? saved), [key]: value });
      } catch {
        // The mutation shows the failure itself.
      }
      // A later choice of the same audience stays on screen until its own answer.
      setChosen((current) =>
        current[key]?.turn === turn ? { ...current, [key]: undefined } : current,
      );
      // An idle queue starts from the loaded settings again: the app may have changed them.
      return turns.current === turn ? null : known;
    });
  }

  return (
    <Card padding={5}>
      <VStack as="section" gap={4} aria-labelledby={titleId}>
        <VStack gap={1}>
          <Heading level={2} id={titleId}>
            Кто видит
          </Heading>
          <Text color="secondary">
            Применяется сразу — на сайте и в приложении. «Все» — любой пользователь ITMO.Widgets,
            «Друзья» — только принятые друзья, «Никто» — только вы.
          </Text>
        </VStack>
        <Loadable
          resource={settings}
          label="Загружаем настройки"
          errorTitle="Не удалось загрузить настройки"
          isCompact
        >
          {(saved) => (
            <VStack gap={3}>
              {AUDIENCE_ROWS.map((row) => (
                <div key={row.key} className="profile-audience">
                  <Text>{row.title}</Text>
                  <SegmentedControl
                    label={row.label}
                    size="sm"
                    value={chosen[row.key]?.value ?? saved[row.key]}
                    onChange={(value) => {
                      const audience = AUDIENCES.find((item) => item.value === value);
                      if (audience) choose(saved, row.key, audience.value);
                    }}
                  >
                    {AUDIENCES.map((item) => (
                      <SegmentedControlItem
                        key={item.value}
                        value={item.value}
                        label={item.label}
                      />
                    ))}
                  </SegmentedControl>
                </div>
              ))}
            </VStack>
          )}
        </Loadable>
      </VStack>
    </Card>
  );
}
