// The only shared script of the site: the light/dark switch. The choice is stored like the
// web app's (`iw-theme`); without it the system scheme applies. Screens follow the theme
// through <source data-dark>, whose media query is replaced while a choice is active.
(function () {
  var KEY = 'iw-theme';
  var root = document.documentElement;

  function saved() {
    try {
      var theme = localStorage.getItem(KEY);
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
    var media = theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : '(prefers-color-scheme: dark)';
    document.querySelectorAll('source[data-dark]').forEach(function (source) {
      source.media = media;
    });
  }

  function isDark() {
    var theme = root.dataset.theme;
    return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }

  apply(saved());
  document.addEventListener('DOMContentLoaded', function () {
    apply(saved());
    var toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        // Storage is unavailable: the choice lasts until the page is closed.
      }
      apply(next);
    });
  });
})();
