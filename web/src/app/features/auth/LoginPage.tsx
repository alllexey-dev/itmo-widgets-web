import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Item } from '@astryxdesign/core/Item';
import { Link } from '@astryxdesign/core/Link';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { Check, CircleAlert, Copy, Download, Hourglass, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import { useNotify } from '../../lib/notify';
import { siteUrl } from '../../lib/router';
import { useSession } from '../../lib/session';
import { LoginFlow, type LoginState } from './challenge';
import './login.css';
import type { PairingKind } from './pairing';
import { QrCode } from './QrCode';

/** What the panel shows; the first four are the stages of a code. */
type Stage = 'waiting' | 'scanned' | 'approved' | 'expired';

const steps = [
  {
    title: 'Откройте ITMO.Widgets на телефоне',
    text: 'Профиль → Устройства → «Подключить устройство»',
  },
  {
    title: 'Наведите камеру на QR-код',
    text: 'Или вставьте ссылку, если сайт открыт на том же телефоне',
  },
  {
    title: 'Сверьте код и подтвердите',
    text: 'Подтверждайте, только если код в приложении совпадает',
  },
];

const status: Record<Stage, { dot: 'accent' | 'success' | 'warning'; text: string }> = {
  waiting: { dot: 'accent', text: 'Ждём, когда приложение отсканирует код' },
  scanned: { dot: 'accent', text: 'Отсканировано. Подтвердите вход в приложении' },
  approved: { dot: 'success', text: 'Вход подтверждён, открываем кабинет…' },
  expired: { dot: 'warning', text: 'Код истёк' },
};

const OFFLINE = 'Нет связи с сервером, пробуем снова';

const LOADING: LoginState = { kind: 'loading' };
const idle = () => () => undefined;
const loading = () => LOADING;

function clock(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function stageOf(view: LoginState): Stage | null {
  if (view.kind === 'expired') return 'expired';
  if (view.kind !== 'active') return null;
  if (view.status === 'CLAIMED') return 'approved';
  return view.status === 'OPENED' ? 'scanned' : 'waiting';
}

/** `?next=` is an app path to return to; anything else, and the login page itself, is ignored. */
function nextPath(requested: string | null): string | null {
  if (!requested?.startsWith('/') || requested.startsWith('//')) return null;
  return requested === '/login' ||
    requested.startsWith('/login?') ||
    requested.startsWith('/login/')
    ? null
    : requested;
}

function Panel({ view, flow }: { view: LoginState; flow: LoginFlow }) {
  const notify = useNotify();
  const stage = stageOf(view);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      notify.show('Ссылка скопирована');
    } catch {
      notify.error('Не удалось скопировать ссылку');
    }
  }

  if (view.kind === 'failed') {
    const limited = view.error instanceof ApiError && view.error.status === 429;
    return (
      <EmptyState
        icon={limited ? <Hourglass size={32} /> : <CircleAlert size={32} />}
        title={
          limited ? 'Слишком много попыток, подождите пару минут' : 'Не удалось получить QR-код'
        }
        description={limited ? undefined : errorText(view.error, 'Попробуйте ещё раз')}
        headingLevel={2}
        actions={
          <Button
            label="Повторить"
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={() => flow.renew()}
          />
        }
      />
    );
  }

  if (!stage) {
    return (
      <div className="login-qr" data-stage="loading">
        <Center height="100%">
          <Spinner size="lg" aria-label="Получаем QR-код" />
        </Center>
      </div>
    );
  }

  const live = view.kind === 'active' && stage !== 'approved' ? view : null;
  const link =
    view.kind === 'expired' ? view.link : view.kind === 'active' ? view.challenge.link : '';
  const offline = live?.offline === true;
  const line = offline ? OFFLINE : status[stage].text;

  return (
    <>
      <div className="login-qr" data-stage={stage}>
        {/* A code that no longer works stays as a faded picture, not as something to scan. */}
        <div className="login-qr-symbol" aria-hidden={live ? undefined : true}>
          <QrCode value={link} label="QR-код для входа" />
        </div>
        {stage === 'expired' ? (
          <div className="login-qr-cover">
            <Button
              label="Новый код"
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={() => flow.renew()}
            />
          </div>
        ) : null}
        {stage === 'approved' ? (
          <div className="login-qr-cover">
            <span className="login-done">
              <Check size={32} />
            </span>
          </div>
        ) : null}
      </div>

      {view.kind === 'active' ? (
        <VStack gap={1} hAlign="center">
          <Text type="supporting" color="secondary">
            Код для сверки
          </Text>
          <Text size="3xl" weight="bold" hasTabularNumbers className="login-code">
            <span translate="no">{view.challenge.sas}</span>
          </Text>
        </VStack>
      ) : null}

      <VStack gap={2} width="100%">
        <ProgressBar
          label="Время действия кода"
          isLabelHidden
          value={live ? live.remaining : stage === 'approved' ? 1 : 0}
          max={live ? live.challenge.lifetime : 1}
          variant={stage === 'approved' ? 'success' : stage === 'expired' ? 'warning' : 'accent'}
        />
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center" role="status">
            <StatusDot
              variant={offline ? 'warning' : status[stage].dot}
              label={line}
              isPulsing={live !== null && !offline}
            />
            <Text type="supporting">{line}</Text>
          </HStack>
          {live ? (
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {clock(live.remaining)}
            </Text>
          ) : null}
        </HStack>
      </VStack>

      {live ? (
        <Button
          label="Скопировать ссылку"
          variant="secondary"
          width="100%"
          className="login-copy"
          icon={<Copy size={16} />}
          onClick={() => void copy(live.challenge.link)}
        />
      ) : null}
    </>
  );
}

/**
 * `/login`: the phone approves this browser. A visitor gets a `CONNECT` code; a signed-in user sent
 * here with `?next=` (the shell's dialogs) gets a `RENEW` code of the connection the browser has.
 */
export default function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = nextPath(params.get('next'));

  // The code is created only once the page knows which one it needs, and that never changes after.
  const [kind, setKind] = useState<PairingKind | null>(null);
  const known = session.status !== 'loading';
  const signedInAlready = !kind && known && session.user !== null && !next;
  if (!kind && known && !signedInAlready) setKind(session.user ? 'RENEW' : 'CONNECT');

  const flow = useMemo(() => (kind ? new LoginFlow(kind) : null), [kind]);
  const view = useSyncExternalStore(flow ? flow.subscribe : idle, flow ? flow.getState : loading);

  const { restart } = session;
  const approved = useCallback(() => {
    void restart().then(() => navigate(next ?? '/', { replace: true }));
  }, [restart, navigate, next]);

  useEffect(() => {
    if (!flow) return;
    flow.start(approved);
    return () => flow.stop();
  }, [flow, approved]);

  if (signedInAlready) return <Navigate to="/" replace />;

  const stage = stageOf(view);
  const current = stage === 'scanned' ? 2 : stage === 'approved' ? 3 : 0;

  return (
    <div className="login">
      <header className="login-top">
        <Link href={siteUrl('/')} isStandalone color="primary" weight="semibold">
          <HStack gap={2} vAlign="center">
            <img src="/img/icon.webp" alt="" className="login-logo" />
            ITMO.Widgets
          </HStack>
        </Link>
        {/* One link, two labels: the long one does not fit next to the logo on a phone. */}
        <span className="login-download" data-size="wide">
          <Button
            label="Скачать приложение"
            href={siteUrl('/#download')}
            variant="ghost"
            icon={<Download size={16} />}
          />
        </span>
        <span className="login-download" data-size="narrow">
          <Button
            label="Скачать"
            href={siteUrl('/#download')}
            variant="ghost"
            icon={<Download size={16} />}
          />
        </span>
      </header>

      <main className="login-main">
        {!kind || !flow ? (
          <Spinner size="lg" aria-label="Проверяем вход" />
        ) : (
          <Card padding={0} elevation="med" className="login-card">
            <div className="login-grid">
              <VStack gap={6} padding={8}>
                <VStack gap={2}>
                  <Heading level={1}>
                    {kind === 'RENEW' ? 'Подтвердите вход на телефоне' : 'Вход через приложение'}
                  </Heading>
                  <Text color="secondary">
                    {kind === 'RENEW'
                      ? 'Для действий модератора и администратора вход подтверждается раз в 7 дней. Этот браузер останется подключённым.'
                      : 'Пароль не нужен: вход подтверждается в ITMO.Widgets на вашем телефоне.'}
                  </Text>
                </VStack>

                <ol className="login-steps">
                  {steps.map((step, index) => (
                    <li key={step.title}>
                      <Item
                        as="div"
                        align="start"
                        startContent={
                          <span
                            className="login-step-mark"
                            data-state={
                              index < current ? 'done' : index === current ? 'current' : 'next'
                            }
                          >
                            {index < current ? <Check size={14} /> : index + 1}
                          </span>
                        }
                        label={
                          <Text weight={index === current ? 'semibold' : 'normal'}>
                            {step.title}
                          </Text>
                        }
                        description={step.text}
                      />
                    </li>
                  ))}
                </ol>

                <Text type="supporting" color="secondary">
                  Вход на этом устройстве отключится сам, если не заходить 30 дней. Отключить его
                  раньше можно в приложении: Профиль → Устройства.
                </Text>
              </VStack>

              <VStack
                as="section"
                aria-label="QR-код для входа"
                gap={4}
                padding={8}
                hAlign="center"
                className="login-panel"
              >
                <Panel view={view} flow={flow} />
              </VStack>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
