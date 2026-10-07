import { render } from '@testing-library/svelte';
import App from '../App.svelte';
import '../lib/icons';
import { router } from '../lib/router.svelte';

/** Renders the whole app at an app path (`/login?code=...`, `/admin/users`) under the real router. */
export function renderApp(path = '/') {
  history.replaceState(null, '', `/app${path}`);
  router.refresh();
  return render(App);
}
