import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Heading } from '@astryxdesign/core/Heading';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { useId } from 'react';
import { useSession } from './session';

/** The two dialogs of a session that needs the phone again: a lost one and an old approval. */
export function SessionDialogs() {
  const session = useSession();
  const titleId = useId();
  const textId = useId();

  if (session.lost) {
    // Modal on purpose: the page under it stays, but nothing works until the user signs in again.
    return (
      <Dialog
        isOpen
        onOpenChange={() => undefined}
        purpose="required"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <Layout
          content={
            <LayoutContent>
              <VStack gap={2}>
                <Heading level={2} id={titleId}>
                  Сессия истекла
                </Heading>
                <Text color="secondary" id={textId}>
                  Войдите заново, чтобы продолжить.
                </Text>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack hAlign="end">
                <Button
                  label="Войти"
                  variant="primary"
                  onClick={session.signInAgain}
                  data-autofocus
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={session.reauth}
      onOpenChange={(isOpen) => {
        if (!isOpen) session.dismissReauth();
      }}
      purpose="info"
    >
      <Layout
        header={
          <DialogHeader
            title="Подтвердите вход на телефоне"
            onOpenChange={() => session.dismissReauth()}
          />
        }
        content={
          <LayoutContent>
            <Text color="secondary">
              Для действий модератора и администратора вход подтверждается раз в 7 дней.
              Отсканируйте QR-код в приложении, и эта страница откроется снова.
            </Text>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="Не сейчас" variant="ghost" onClick={session.dismissReauth} />
              <Button label="Подтвердить" variant="primary" onClick={session.reauthenticate} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
