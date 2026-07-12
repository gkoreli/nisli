/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { defineRouter } from './application.js';
import { notFound, route } from './route.js';

describe('DOM-free application router definition', () => {
  it('defines, constructs hrefs, and matches in Node without touching HTMLElement', () => {
    expect('HTMLElement' in globalThis).toBe(false);
    expect('customElements' in globalThis).toBe(false);

    const AppRouter = defineRouter({
      home: route('/', { render: () => { throw new Error('not rendered'); } }),
      user: route('/users/:id', { render: () => { throw new Error('not rendered'); } }),
      notFound: notFound({ render: () => { throw new Error('not rendered'); } }),
    }, { base: '/app' });

    expect(AppRouter.routes.home.href()).toBe('/app/');
    expect(AppRouter.routes.user.href({ params: { id: '42' } })).toBe('/app/users/42');
    const match = AppRouter.match('/app/users/42', 'http://nisli.local/');
    expect(match?.route).toBe(AppRouter.routes.user);
    expect(match?.params).toEqual({ id: '42' });
    expect(AppRouter.match('/app/missing', 'http://nisli.local/')?.route).toBe(AppRouter.notFound);
  });
});
