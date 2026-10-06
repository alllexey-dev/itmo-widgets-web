// The package stylesheet must come before every component's CSS module, so this import is first.
import './ui/global.css';
import '@alllexey/ui/elements';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
