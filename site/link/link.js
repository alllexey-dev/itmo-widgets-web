// "Открыть в приложении": on Android an intent:// URL opens the app even inside in-app browsers that would
// reload this https page, and falls back to the releases page without the app. Elsewhere there is no app to open.
(function () {
  var button = document.getElementById('open-app');
  if (!button) return;
  if (!/Android/i.test(navigator.userAgent)) {
    button.hidden = true;
    return;
  }
  var fallback = encodeURIComponent('https://github.com/alllexey-dev/ITMO.Widgets/releases/latest');
  button.href = 'intent://' + location.host + location.pathname +
    '#Intent;scheme=https;package=dev.alllexey.itmowidgets;S.browser_fallback_url=' + fallback + ';end';
})();
