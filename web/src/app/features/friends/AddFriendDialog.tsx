import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack } from '@astryxdesign/core/Stack';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import { useApiMutation } from '../../lib/data';
import { act, staleAfter } from './api';
import { ISU_PATTERN } from './labels';
import type { UserProfile } from './types';

export type Known = 'friend' | 'incoming' | 'outgoing';

/** A request that would change nothing is answered under the field, without asking Backend. */
const POINTLESS: Partial<Record<Known, string>> = {
  friend: 'Этот человек уже у вас в друзьях',
  outgoing: 'Заявка этому человеку уже отправлена',
};

interface Props {
  /** The visitor's own ISU number: nobody befriends themselves. */
  self: number;
  /** What the loaded lists know about a number: already a friend, or a request is pending. */
  relationOf: (isu: number) => Known | undefined;
  /**
   * The request went through. The profile says whether it made a friend at once; `crossed` is true
   * when that person had asked first.
   */
  onSent: (profile: UserProfile, crossed: boolean) => void;
  onClose: () => void;
}

/**
 * "Добавить" by ISU number; an error stays under the field. Finding someone by name needs My ITMO,
 * which only the app reads.
 */
export function AddFriendDialog({ self, relationOf, onSent, onClose }: Props) {
  const [isu, setIsu] = useState('');
  const [error, setError] = useState('');
  const request = useApiMutation({
    run: (target: number) => act(target, 'request'),
    forgets: (target) => staleAfter(target),
  });

  function send(event: FormEvent) {
    event.preventDefault();
    const value = isu.trim();
    if (!ISU_PATTERN.test(value)) {
      setError('Номер ИСУ — шесть цифр');
      return;
    }
    if (Number(value) === self) {
      setError('Это ваш номер');
      return;
    }
    const known = relationOf(Number(value));
    const pointless = known ? POINTLESS[known] : undefined;
    if (pointless) {
      setError(pointless);
      return;
    }
    request.mutateAsync(Number(value)).then(
      (profile) => onSent(profile, known === 'incoming'),
      (failure: unknown) => {
        setError(
          failure instanceof ApiError && failure.status === 404
            ? 'Этого человека нет в ITMO.Widgets'
            : errorText(failure, 'Не удалось отправить заявку'),
        );
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      purpose="form"
      width={440}
    >
      <form onSubmit={send} noValidate>
        <Layout
          header={
            <DialogHeader
              title="Добавить в друзья"
              subtitle="Найти человека по имени можно в приложении. Здесь — по номеру ИСУ."
              onOpenChange={onClose}
            />
          }
          content={
            <LayoutContent>
              <TextInput
                label="Номер ИСУ"
                value={isu}
                onChange={(value) => {
                  setIsu(value);
                  setError('');
                }}
                status={error ? { type: 'error', message: error } : undefined}
                inputMode="numeric"
                autoComplete="off"
                hasAutoFocus
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button label="Отмена" variant="ghost" onClick={onClose} />
                <Button
                  label="Отправить заявку"
                  variant="primary"
                  type="submit"
                  isLoading={request.isPending}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </form>
    </Dialog>
  );
}
