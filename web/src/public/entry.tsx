import '../shared/styles';

import { createRoot, hydrateRoot } from 'react-dom/client';

import { AppTheme } from '../shared/AppTheme';
import { pages, type PublicPageId } from './pages';

// The build prerenders every public page (`prerender.tsx`) and keeps this script only on
// the pages that hydrate. In development nothing is prerendered, so it renders any page.
const root = document.getElementById('root') as HTMLElement;
const page = pages[root.dataset.page as PublicPageId];

void page.load().then(({ default: Page }) => {
  const tree = (
    <AppTheme>
      <Page />
    </AppTheme>
  );
  if (root.dataset.prerendered === undefined) createRoot(root).render(tree);
  else hydrateRoot(root, tree);
});
