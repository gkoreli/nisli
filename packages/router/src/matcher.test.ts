import { describe, expect, it } from 'vitest';
import { createMatcher, normalizePathname } from './matcher.js';
import { enumParam, numberParam } from './query.js';
import { notFound, route } from './route.js';
import { html } from '@nisli/core';
import { defineRouter } from './application.js';

const noop = () => html``;

describe('route href construction', () => {
  it('encodes path and query parameters', () => {
    const user = route('/users/:userId', {
      query: { tab: enumParam(['profile', 'activity'] as const).default('profile') },
      render: noop,
    });
    expect(user.href({ params: { userId: 'a/b' }, query: { tab: 'activity' } }))
      .toBe('/users/a%2Fb?tab=activity');
    expect(user.href({ params: { userId: '42' }, query: { tab: 'profile' } }))
      .toBe('/users/42');
  });

  it('encodes catch-all segments without losing slash structure', () => {
    const files = route('/files/*path', { render: noop });
    expect(files.href({ params: { path: 'docs/hello world' } })).toBe('/files/docs/hello%20world');
  });

  it('constructs hrefs under the application base path', () => {
    const AppRouter = defineRouter({
      home: route('/', { render: noop }),
      user: route('/users/:id', { render: noop }),
    }, { base: '/app/' });
    expect(AppRouter.routes.home.href()).toBe('/app/');
    expect(AppRouter.routes.user.href({ params: { id: '42' } })).toBe('/app/users/42');
    expect(AppRouter.match('/app/users/42')?.params).toEqual({ id: '42' });
  });
});

describe('pure matcher', () => {
  it('normalizes slashes and gives static routes priority', () => {
    const matcher = createMatcher({ routes: {
      item: route('/items/:id', { render: noop }),
      newItem: route('/items/new', { render: noop }),
    }});
    expect(normalizePathname('//items/new/')).toBe('/items/new');
    expect(matcher('/items/new')?.name).toBe('newItem');
    expect(matcher('/items/a%2Fb?x=1#details')?.params).toEqual({ id: 'a/b' });
    expect(matcher('/items/a%2Fb?x=1#details')?.searchParams.get('x')).toBe('1');
    expect(matcher('/items/a%2Fb?x=1#details')?.url.hash).toBe('#details');
  });

  it('parses query codecs and falls through invalid input to not-found', () => {
    const matcher = createMatcher({
      routes: { page: route('/page', { query: { page: numberParam() }, render: noop }) },
      notFound: notFound({ render: noop }),
    });
    expect(matcher('/page?page=2')?.query).toEqual({ page: 2 });
    expect(matcher('/page?page=no')?.notFound).toBe(true);
  });

  it('supports base paths and catch-all matching', () => {
    const matcher = createMatcher({
      base: '/app/',
      routes: { file: route('/files/*path', { render: noop }) },
    });
    expect(matcher('/app/files/a/b')?.params).toEqual({ path: 'a/b' });
    expect(matcher('/files/a/b')).toBeNull();
  });

  it('rejects ambiguous route shapes and non-final catch-alls', () => {
    expect(() => createMatcher({ routes: {
      first: route('/users/:id', { render: noop }),
      second: route('/users/:name', { render: noop }),
    }})).toThrow('Ambiguous routes');
    expect(() => createMatcher({ routes: {
      invalid: route('/files/*path/edit', { render: noop }),
    }})).toThrow('final segment');
    expect(() => createMatcher({ routes: {
      alias: route('/files/:path*', { render: noop }),
    }})).toThrow('use *name');
  });
});
