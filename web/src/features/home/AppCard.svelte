<script lang="ts">
  import { Icon } from '@alllexey/ui';

  // What only the app does: the site never reads My ITMO.
</script>

<section class="m3-card secondary app" aria-labelledby="home-app">
  <h2 id="home-app" class="m3-section-title">Всё остальное — в приложении</h2>
  <p class="m3-body-medium">
    Расписание, зачётка, QR-пропуск и виджеты работают в приложении на телефоне: сайт не обращается
    к My ITMO.
  </p>
  <a class="m3-btn" href="/#download">
    <Icon name="download" />
    Скачать приложение
  </a>
</section>

<style>
  .app {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  h2,
  p {
    margin: 0;
  }
</style>
