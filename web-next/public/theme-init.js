// Applies the shared alllexey.dev light/dark choice before the first paint, so a manual dark theme
// does not flash: the cookie is written by @alllexey/ui (mode|seed|variant), and the package's
// default stylesheet covers both modes until the app computes the colours from the seed.
(function () {
  try {
    var match = document.cookie.match(/(?:^|; )alllexey-theme=([^;]*)/);
    var mode = match ? decodeURIComponent(match[1]).split('|')[0] : 'auto';
    if (mode === 'light' || mode === 'dark') document.documentElement.dataset.theme = mode;
  } catch (e) {
    // Cookies are unavailable: the system scheme applies.
  }
})();
