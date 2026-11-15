import '../shared/styles';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { BASE } from './lib/router';

// The cabinet lives under `/app/`; nginx redirects `/app` there, the dev server serves it as is.
if (window.location.pathname === BASE) {
  const { search, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${BASE}/${search}${hash}`);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
