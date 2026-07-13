import { describe, expect, it } from 'vitest';
import { createMatcher, normalizePathname } from './matcher.js';
import { enumParam, numberParam } from './query.js';
import { notFound, redirect, route } from './route.js';
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

  it('carries over arbitrary query params and hash while keeping typed query', () => {
    const page = route('/:locale/posts/:slug', {
      params: { locale: enumParam(['en', 'ka'] as const) },
      query: { tab: enumParam(['a', 'b'] as const).default('a') },
      render: noop,
    });
    const current = new URL('http://x/en/posts/hello?tab=b&utm_source=news&inquiry=42#section');
    const href = page.href({
      params: { locale: 'ka', slug: 'hello' },
      query: { tab: 'b' },
      search: current.searchParams,
      hash: current.hash,
    });
    const u = new URL(href, 'http://x');
    expect(u.pathname).toBe('/ka/posts/hello');
    expect(u.searchParams.get('tab')).toBe('b');           // typed declared query
    expect(u.searchParams.get('utm_source')).toBe('news');  // arbitrary passthrough
    expect(u.searchParams.get('inquiry')).toBe('42');       // arbitrary passthrough
    expect(u.hash).toBe('#section');
  });

  it('declared query at its default value overrides carried-over passthrough', () => {
    const page = route('/p', { query: { tab: enumParam(['a', 'b'] as const).default('a') }, render: noop });
    // passthrough carries tab=b, but the builder explicitly asks for the default 'a'
    expect(page.href({ query: { tab: 'a' }, search: 'tab=b&keep=1' })).toBe('/p?keep=1');
    // hash string without a leading '#' is normalized (query-less route)
    const simple = route('/s', { render: noop });
    expect(simple.href({ hash: 'top' })).toBe('/s#top');
    expect(simple.href({ search: 'utm=x', hash: '#a' })).toBe('/s?utm=x#a');
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

  it('validates path-parameter codecs and treats an invalid segment as no-match', () => {
    const matcher = createMatcher({
      routes: {
        localized: route('/:locale/about', {
          params: { locale: enumParam(['en', 'ka'] as const) },
          render: noop,
        }),
      },
      notFound: notFound({ render: noop }),
    });
    expect(matcher('/en/about')?.params).toEqual({ locale: 'en' });
    expect(matcher('/ka/about')?.params).toEqual({ locale: 'ka' });
    // An unlisted locale is a NO-MATCH → falls through to not-found.
    expect(matcher('/fr/about')?.notFound).toBe(true);
  });

  it('numberParam path codec parses and href re-serializes', () => {
    const post = route('/posts/:id', { params: { id: numberParam() }, render: noop });
    const matcher = createMatcher({ routes: { post } });
    expect(matcher('/posts/42')?.params).toEqual({ id: 42 });
    expect(post.href({ params: { id: 42 } })).toBe('/posts/42');
  });

  it('resolves redirect definitions to their target with matched params', () => {
    const matcher = createMatcher({
      routes: { user: route('/users/:id', { render: noop }) },
      redirects: {
        legacy: redirect('/u/:id', ({ params }) => `/users/${params.id}`),
        root: redirect('/home', '/'),
      },
    });
    expect(matcher('/u/42')?.redirect).toBe('/users/42');
    expect(matcher('/home')?.redirect).toBe('/');
    expect(matcher('/users/42')?.redirect).toBeUndefined();
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
