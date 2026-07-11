/** Browser entry for the Vite + Nisli HMR development server. */
import './styles.css';
import { homePage } from '../src/pages/home.js';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app development mount point.');

homePage().mount(app);

document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  const dark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.theme = dark ? 'dark' : 'light';
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
});
