import '@alllexey/ui/css';
import '@alllexey/ui/elements';
import { mount } from 'svelte';
import App from './App.svelte';
import './lib/icons';

const target = document.getElementById('app');
if (!target) throw new Error('The #app element is missing from index.html');
mount(App, { target });
