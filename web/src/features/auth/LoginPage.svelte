<script lang="ts">
  import {
    EmptyState,
    forget,
    Icon,
    LoadingIndicator,
    Shape,
    ThemeSettings,
    WavyProgress,
    snackbars,
  } from '@alllexey/ui';
  import { onMount, untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import { router } from '../../lib/router.svelte';
  import { session } from '../../lib/session.svelte';
  import { theme } from '../../lib/theme.svelte';
  import { LoginFlow } from './challenge.svelte';
  import { formatLoginCode, loginUrl, parseLoginCode } from './login';
  import QrCode from './QrCode.svelte';

  const scanned = $derived(parseLoginCode(router.query.get('code')));
  // `?next=` comes from "Войти" in the shell's sign-in dialogs: a signed-in user asked to sign in again.
  const requested = router.query.get('next');
  const next = requested?.startsWith('/') && !requested.startsWith('/login') ? requested : null;
  let checking = $state(true);
  let settings = $state(false);
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
      else checking = false;
    });
    return () => {
      active = false;
    };
  });

  // The code is created only for a visitor who will see it: not while checking, not for a scanned code.
  $effect(() => {
    if (checking || scanned) return;
    const created = new LoginFlow(approved);
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

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      snackbars.show('Код скопирован');
    } catch {
      snackbars.error('Не удалось скопировать код');
    }
  }
</script>

<div class="page">
  <header class="top">
    <a class="brand m3-title-medium m3-emphasized" href="/">
      <img src="{import.meta.env.BASE_URL}favicon.png" alt="" width="32" height="32" />
      ITMO.Widgets
    </a>
    <button class="m3-icon-btn" onclick={() => (settings = true)} aria-label="Оформление">
      <Icon name="palette" />
    </button>
  </header>

  {#if checking}
    <main class="center">
      <LoadingIndicator size={56} label="Проверяем вход" />
    </main>
  {:else if scanned}
    <main class="center">
      <section class="m3-card scanned" aria-labelledby="scanned-title">
        <Shape
          shape="cookie9"
          size={56}
          color="var(--md-secondary-container)"
          fg="var(--md-on-secondary-container)"
        >
          <Icon name="smartphone" size={32} />
        </Shape>
        <h1 id="scanned-title" class="m3-title-large">
          Откройте этот код в приложении ITMO.Widgets
        </h1>
        <p class="code" translate="no">{formatLoginCode(scanned)}</p>
        <p class="m3-muted">Профиль → Вход на сайт → введите код</p>
        <button class="m3-btn text" onclick={() => router.go('/login', { replace: true })}>
          <Icon name="login" />
          Войти в браузере на этом устройстве
        </button>
      </section>
    </main>
  {:else}
    <main class="layout">
      <section class="intro">
        <h1 class="title">Вход на сайт</h1>
        <p class="lead m3-muted">
          Пароль не нужен: вход подтверждает приложение ITMO.Widgets на вашем телефоне.
        </p>
        <ol class="steps">
          {#each ['Откройте ITMO.Widgets на телефоне', 'Профиль → Вход на сайт', 'Отсканируйте QR или введите код'] as step, index (step)}
            <li>
              <Shape
                shape="cookie6"
                size={40}
                color="var(--md-secondary-container)"
                fg="var(--md-on-secondary-container)"
              >
                <b>{index + 1}</b>
              </Shape>
              <span>{step}</span>
            </li>
          {/each}
        </ol>
        <p class="hint m3-muted">Нет приложения? <a href="/#download">Скачать</a></p>
      </section>

      <section class="m3-card high panel" aria-label="Код для входа">
        {#if view.kind === 'active'}
          {@const { challenge, remaining, status, offline } = view}
          <div class="qr-tile">
            <QrCode value={loginUrl(challenge.code)} label="QR-код для входа" />
          </div>
          <div class="code-block">
            <span class="m3-label-large m3-muted">Код для входа</span>
            <div class="code-row">
              <span class="code" translate="no">{formatLoginCode(challenge.code)}</span>
              <button
                class="m3-icon-btn"
                onclick={() => copy(challenge.code)}
                aria-label="Скопировать код"
              >
                <Icon name="content_copy" />
              </button>
            </div>
            <div class="countdown">
              <WavyProgress value={remaining} max={challenge.lifetime} />
              <span class="m3-body-small m3-muted">
                Код действует ещё <span class="time">{formatSeconds(remaining)}</span>
              </span>
            </div>
          </div>
          <p class="status" role="status">
            {#if status === 'APPROVED'}
              <Icon name="check_circle" size={20} />
              Вход подтверждён
            {:else if offline}
              <Icon name="cloud_off" size={20} />
              Нет связи с сервером, пробуем снова
            {:else}
              <m3-loading-indicator size="20" aria-hidden="true"></m3-loading-indicator>
              Ждём подтверждения в приложении
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
              title="Не удалось получить код"
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
            title="Код устарел"
            text="Покажем новый, когда будете готовы."
          >
            <button class="m3-btn" onclick={() => flow?.renew()}>
              <Icon name="refresh" />
              Показать новый код
            </button>
          </EmptyState>
        {:else}
          <div class="qr-tile waiting">
            <LoadingIndicator size={56} label="Получаем код" />
          </div>
        {/if}
      </section>
    </main>
  {/if}
</div>

{#if settings}<ThemeSettings {theme} onclose={() => (settings = false)} />{/if}

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) max(16px, env(safe-area-inset-right))
      env(safe-area-inset-bottom) max(16px, env(safe-area-inset-left));
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
    max-width: 1040px;
    width: 100%;
    margin: 0 auto;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: inherit;
    text-decoration: none;
  }
  .brand img {
    border-radius: var(--md-shape-sm);
  }
  .center {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 24px 0 64px;
  }
  .layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 48px;
    align-items: center;
    max-width: 1040px;
    width: 100%;
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
  }
  .code-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .code {
    margin: 0;
    font: 600 32px/1.2 var(--md-mono);
    letter-spacing: 0.12em;
    white-space: nowrap;
    user-select: all;
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
    min-height: 40px;
    margin: 0;
    padding: 4px 16px;
    border-radius: var(--md-shape-full);
    background: var(--md-surface-container-highest);
    color: var(--md-on-surface-variant);
    font: var(--md-body-medium);
  }
  .scanned {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 24px;
    text-align: center;
  }
  .scanned h1,
  .scanned p {
    margin: 0;
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
    /* On a phone the user types the code into the app on the same phone: the code goes first. */
    .code-block {
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
