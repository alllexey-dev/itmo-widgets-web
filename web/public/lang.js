// The RU/EN choice of the landing. `/` is Russian and `/en/` English; the switch in the header
// links between them, and this script stores the language of the clicked link (`data-lang`).
// A visitor who chose English and opens `/` again goes on to `/en/`. Nothing else is stored or
// sent: no requests, no cookies. Loaded in the <head> of both landing documents only.
(function () {
  var KEY = 'itmo-widgets-lang';
  var stored = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch (error) {
    // Storage is off: the switch still works as plain links.
  }
  if (stored === 'en' && document.documentElement.lang === 'ru') {
    window.location.replace('/en/' + window.location.hash);
    return;
  }
  document.addEventListener('click', function (event) {
    var link = event.target instanceof Element ? event.target.closest('a[data-lang]') : null;
    if (!link) return;
    try {
      window.localStorage.setItem(KEY, link.getAttribute('data-lang'));
    } catch (error) {
      // As above: the link still opens the other language.
    }
  });
})();
