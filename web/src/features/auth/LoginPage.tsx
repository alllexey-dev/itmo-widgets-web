import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import {
  Button,
  Card,
  cx,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingIndicator,
  Shape,
  ThemeSettings,
} from '../../ui';
import { Countdown } from './Countdown';
import { formatLoginCode, loginUrl, parseLoginCode } from './login';
import styles from './LoginPage.module.css';
import { QrCode } from './QrCode';
import { sessionQueryKey } from './session';
import { useLoginChallenge, type LoginState } from './useLoginChallenge';
import { useSessionQuery } from './useSession';

export function LoginPage() {
  const session = useSessionQuery();
  const [params] = useSearchParams();
  const scannedCode = parseLoginCode(params.get('code'));

  const [settings, setSettings] = useState(false);

  if (session.data) return <Navigate to="/" replace />;

  return (
    <main className={styles.page}>
      <IconButton
        className={styles.theme}
        icon="palette"
        label="Оформление"
        onClick={() => setSettings(true)}
      />
      <Card as="section" className={styles.card} aria-labelledby="login-title">
        <div className={cx('m3-title-medium m3-emphasized', styles.brand)}>
          <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" width={40} height={40} />
          <span>ITMO.Widgets</span>
        </div>
        <h1 id="login-title" className={styles.title}>
          Вход
        </h1>
        {session.isPending ? (
          <LoadingIndicator label="Проверяем вход" className={styles.checking} />
        ) : scannedCode ? (
          <ScannedCode code={scannedCode} />
        ) : (
          <PhoneLogin />
        )}
      </Card>
      {settings && <ThemeSettings onClose={() => setSettings(false)} />}
    </main>
  );
}

/** Someone scanned the QR with a phone camera instead of the app. */
function ScannedCode({ code }: { code: string }) {
  const navigate = useNavigate();
  return (
    <>
      <div className={cx('m3-card primary', styles.hint)}>
        <Shape shape="cookie9" size={56} tone="secondary">
          <Icon name="smartphone" size={32} />
        </Shape>
        <p className="m3-title-medium">Откройте этот код в приложении ITMO.Widgets</p>
        <p className={styles.code} translate="no">
          {formatLoginCode(code)}
        </p>
        <p>Профиль → Вход на сайт → введите код</p>
      </div>
      <Button
        variant="text"
        icon="login"
        fullWidth
        onClick={() => void navigate('/login', { replace: true })}
      >
        Войти в браузере на этом устройстве
      </Button>
    </>
  );
}

function PhoneLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const handleApproved = useCallback(() => {
    void queryClient.resetQueries({ queryKey: sessionQueryKey });
    void navigate('/', { replace: true });
  }, [queryClient, navigate]);
  const { state, renew } = useLoginChallenge(handleApproved);

  return (
    <>
      <p className="m3-muted">Откройте ITMO.Widgets → Профиль → Вход на сайт и отсканируйте QR</p>
      <LoginCode state={state} onRenew={renew} />
      <p className={styles.footer}>
        Ещё нет приложения? <a href="/">Установить</a>
      </p>
    </>
  );
}

function LoginCode({ state, onRenew }: { state: LoginState; onRenew: () => void }) {
  switch (state.kind) {
    case 'loading':
      return (
        <div className={styles.active}>
          <div className={styles.qrTile}>
            <LoadingIndicator label="Получаем код" className={styles.qrWaiting} />
          </div>
        </div>
      );
    case 'failed':
      return <FailedCode error={state.error} onRetry={onRenew} />;
    case 'expired':
      return (
        <EmptyState
          compact
          icon="timer_off"
          title="Код устарел"
          description="Покажем новый, когда будете готовы."
          action={
            <Button icon="refresh" onClick={onRenew}>
              Показать новый код
            </Button>
          }
        />
      );
    case 'active': {
      const { challenge, remaining, status, offline } = state;
      return (
        <div className={styles.active}>
          <div className={styles.qrTile}>
            <QrCode value={loginUrl(challenge.code)} label="QR-код для входа" />
          </div>
          <div className={styles.codeBlock}>
            <span className="m3-muted">или введите код</span>
            <p className={styles.code} translate="no">
              {formatLoginCode(challenge.code)}
            </p>
          </div>
          <Countdown remaining={remaining} total={challenge.lifetime} />
          <p className={styles.status} role="status">
            {status === 'APPROVED' ? (
              <>
                <Icon name="check_circle" size={20} />
                Вход подтверждён
              </>
            ) : offline ? (
              <>
                <Icon name="cloud_off" size={20} />
                Нет связи с сервером, пробуем снова
              </>
            ) : (
              <>
                <m3-loading-indicator size={20} aria-hidden="true" />
                Ждём подтверждения в приложении
              </>
            )}
          </p>
        </div>
      );
    }
  }
}

function FailedCode({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 429) {
    return (
      <EmptyState
        compact
        icon="hourglass_top"
        title="Слишком много попыток, подождите пару минут"
        action={
          <Button variant="tonal" icon="refresh" onClick={onRetry}>
            Повторить
          </Button>
        }
      />
    );
  }
  return (
    <ErrorState
      compact
      title="Не удалось получить код"
      description={error.message}
      onRetry={onRetry}
    />
  );
}
