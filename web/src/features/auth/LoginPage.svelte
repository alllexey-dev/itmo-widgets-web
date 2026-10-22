<script lang="ts">
  import {
    EmptyState,
    forget,
    Icon,
    LoadingIndicator,
    Shape,
    TopBar,
    WavyProgress,
    snackbars,
  } from '@alllexey/ui';
  import { onMount, untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import { router } from '../../lib/router.svelte';
  import { session } from '../../lib/session.svelte';
  import { LoginFlow } from './challenge.svelte';
  import type { PairingKind } from './pairing';
  import QrCode from './QrCode.svelte';

  // `?next=` comes from "Войти" in the shell's dialogs: a signed-in user is asked for a fresh approval.
  const requested = router.query.get('next');
  const next = requested?.startsWith('/') && !requested.startsWith('/login') ? requested : null;
  let kind = $state<PairingKind | null>(null);
  let flow = $state<LoginFlow | null>(null);

  function approved() {
    // Another phone may have approved: cached pages belong to the old user.
    forget();
    session.reset();
    router.go(next ?? '/', { replace: true });
  }

  onMount(() => {
    let active = true;
    void session.ensure().then(() => {
      if (!active) return;
      if (session.user && !next) router.go('/', { replace: true });
      else kind = session.user ? 'RENEW' : 'CONNECT';
    });
    return () => {
      active = false;
    };
  });

  // The code is created only once the page knows which one it needs.
  $effect(() => {
    if (!kind) return;
    const created = new LoginFlow(kind, approved);
    flow = created;
    // Starting reads the flow's own state; it must not become a dependency of this effect.
    untrack(() => created.start());
    return () => created.stop();
  });

  const view = $derived(flow?.state ?? { kind: 'loading' as const });

  function formatSeconds(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      snackbars.show('Ссылка скопирована');
    } catch {
      snackbars.error('Не удалось скопировать ссылку');
    }
  }
</script>

<div class="page">
  <TopBar brand="ITMO.Widgets" brandHref="/" />

  {#if !kind}
    <main class="center">
      <LoadingIndicator size={56} label="Проверяем вход" />
    </main>
  {:else}
    <main class="layout">
      <section class="intro">
        {#if kind === 'RENEW'}
          <h1 class="title">Подтвердите вход на телефоне</h1>
          <p class="lead m3-muted">
            Для действий модератора и администратора вход подтверждается раз в 7 дней. Этот браузер
            останется подключённым.
          </p>
        {:else}
          <h1 class="title">Вход на сайт</h1>
          <p class="lead m3-muted">
            Пароль не нужен: вход подтверждает приложение ITMO.Widgets на вашем телефоне.
          </p>
        {/if}
        <ol class="steps">
          {#each ['Откройте ITMO.Widgets на телефоне', 'Профиль → Устройства → Подключить устройство', 'Отсканируйте QR и сверьте код'] as step, index (step)}
            <li>
              <Shape shape="cookie6" size={40} tone="secondary">
                <b>{index + 1}</b>
              </Shape>
              <span>{step}</span>
            </li>
          {/each}
        </ol>
        <p class="hint m3-muted">Нет приложения? <a href="/#download">Скачать</a></p>
      </section>

      <section class="m3-card high panel" aria-label="QR-код для входа">
        {#if view.kind === 'active'}
          {@const { challenge, remaining, status, offline } = view}
          <div class="qr-tile">
            <QrCode value={challenge.link} label="QR-код для входа" />
          </div>
          <div class="code-block">
            <span class="m3-label-large m3-muted">Код в приложении</span>
            <span class="code" translate="no">{challenge.sas}</span>
            <span class="m3-body-small m3-muted">Подтверждайте, только если код совпадает</span>
            <div class="countdown">
              <WavyProgress value={remaining} max={challenge.lifetime} />
              <span class="m3-body-small m3-muted">
                QR-код действует ещё <span class="time">{formatSeconds(remaining)}</span>
              </span>
            </div>
          </div>
          <button class="m3-btn text copy" onclick={() => copy(challenge.link)}>
            <Icon name="content_copy" />
            Скопировать ссылку для приложения
          </button>
          <p class="status" role="status">
            {#if status === 'CLAIMED'}
              <Icon name="check_circle" size={20} />
              Вход подтверждён
            {:else if offline}
              <Icon name="cloud_off" size={20} />
              Нет связи с сервером, пробуем снова
            {:else if status === 'OPENED'}
              <m3-loading-indicator size="20" aria-hidden="true"></m3-loading-indicator>
              Сверьте код и подтвердите в приложении
            {:else}
              <m3-loading-indicator size="20" aria-hidden="true"></m3-loading-indicator>
              Ждём, когда приложение отсканирует QR
            {/if}
          </p>
        {:else if view.kind === 'failed'}
          {#if view.error instanceof ApiError && view.error.status === 429}
            <EmptyState icon="hourglass_top" title="Слишком много попыток, подождите пару минут">
              <button class="m3-btn tonal" onclick={() => flow?.renew()}>
                <Icon name="refresh" />
                Повторить
              </button>
            </EmptyState>
          {:else}
            <EmptyState
              error
              title="Не удалось получить QR-код"
              text={errorText(view.error, 'Попробуйте ещё раз')}
            >
              <button class="m3-btn tonal" onclick={() => flow?.renew()}>
                <Icon name="refresh" />
                Повторить
              </button>
            </EmptyState>
          {/if}
        {:else if view.kind === 'expired'}
          <EmptyState
            icon="timer_off"
            title="QR-код устарел"
            text="Покажем новый, когда будете готовы."
          >
            <button class="m3-btn" onclick={() => flow?.renew()}>
              <Icon name="refresh" />
              Показать новый QR-код
            </button>
          </EmptyState>
        {:else}
          <div class="qr-tile waiting">
            <LoadingIndicator size={56} label="Получаем QR-код" />
          </div>
        {/if}
      </section>
    </main>
  {/if}
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    /* TopBar keeps its own 16 px and the top inset. */
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .center {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 24px 16px 64px;
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 48px;
    align-items: center;
    width: min(1040px, calc(100% - 32px));
    margin: 0 auto;
    padding: 24px 0 64px;
  }
  .title {
    margin: 0;
    font: var(--md-display-medium);
    font-weight: 500;
    font-stretch: 108%;
    letter-spacing: -0.5px;
  }
  .lead {
    font: var(--md-body-large);
    margin: 12px 0 28px;
    max-width: 460px;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 16px;
    font: var(--md-title-medium);
  }
  .hint {
    margin: 32px 0 0;
    font: var(--md-body-medium);
  }
  .hint a {
    color: var(--md-primary);
  }
  .panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 32px;
    min-height: 520px;
    justify-content: center;
  }
  /* Always dark on light, whatever the theme: not every scanner reads inverted codes. */
  .qr-tile {
    display: grid;
    width: min(280px, 100%);
    aspect-ratio: 1;
    padding: 12px;
    border-radius: var(--md-shape-xl);
    background: white;
  }
  .qr-tile.waiting {
    place-items: center;
    background: var(--md-surface-container-highest);
  }
  .code-block {
    width: min(280px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .code {
    margin: 0;
    font: 600 32px/1.2 var(--md-mono);
    letter-spacing: 0.12em;
    white-space: nowrap;
  }
  .countdown {
    width: 100%;
    display: grid;
    gap: 8px;
    justify-items: center;
  }
  .countdown :global(.progress) {
    width: 100%;
  }
  .time {
    color: var(--md-on-surface);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--md-control);
    margin: 0;
    padding: 4px 16px;
    border-radius: var(--md-shape-full);
    background: var(--md-surface-container-highest);
    color: var(--md-on-surface-variant);
    font: var(--md-body-medium);
  }
  @media (max-width: 860px) {
    .layout {
      grid-template-columns: 1fr;
      gap: 24px;
      padding-top: 8px;
    }
    .title {
      font: var(--md-display-small);
      font-weight: 500;
    }
    .lead {
      margin-bottom: 20px;
    }
    .panel {
      padding: 24px 16px;
      gap: 20px;
      min-height: 0;
    }
    /* On a phone the QR cannot be scanned by the same phone: the link for the app goes first. */
    .copy {
      order: -1;
    }
    .qr-tile {
      width: 200px;
    }
    .steps li {
      font: var(--md-title-small);
    }
  }
  @media (max-width: 420px) {
    .code {
      font-size: 28px;
    }
  }
</style>
