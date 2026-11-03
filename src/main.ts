import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { init } from './lib/state.svelte';

init();
const target = document.getElementById('app')!;
target.replaceChildren(); // <noscript>-Hinweis entfernen
mount(App, { target });
