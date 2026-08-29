import { computed, effect, inject } from '@nisli/core';
import { Router } from '@nisli/router';
import { App, useSkin, setScheme, defaultSkin } from '@nisli/engine';
import { AppRouter, nav } from './router.js';
import { settings, ready } from './data/store.js';

// The whole application shell. The one visual decision in the app: which skin.
// Which scheme (light/dark/system) is a preference; the engine applies it.
await ready;
const bare = new URLSearchParams(location.search).has('bare');
useSkin(bare ? null : defaultSkin, { scheme: settings.value.appearance ?? 'system' });
effect(() => { setScheme(settings.value.appearance ?? 'system'); });
const router = inject(Router);
const app = App({
  brand: 'Ledger',
  nav,
  location: computed(() => router.url.value.pathname),
  content: AppRouter({}),
});
import('@nisli/core').then(({ el }) => el('div', { style: 'display:contents' }, [app]).mount(document.body));
