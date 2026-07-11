/**
 * utils.test.ts — cn()/cv() class utilities and interop helpers.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { signal } from '@nisli/core';
import { attr, boolAttr, captureChildren, cn, cv } from './utils.js';

describe('cn()', () => {
  it('joins strings and skips falsy values', () => {
    expect(cn('a', undefined, 'b', null, false, '', 'c')).toBe('a b c');
  });

  it('flattens arrays and resolves records', () => {
    expect(cn('a', ['b', ['c']], { on: true, off: false, missing: undefined })).toBe(
      'a b c on',
    );
  });
});

describe('cv()', () => {
  const badge = cv('base', {
    variants: {
      variant: { default: 'v-default', outline: 'v-outline' },
      size: { sm: 's-sm', lg: 's-lg' },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
    compoundVariants: [{ variant: 'outline', size: 'lg', class: 'compound' }],
  });

  it('applies defaults when nothing is selected', () => {
    expect(badge()).toBe('base v-default s-sm');
  });

  it('applies explicit selections over defaults', () => {
    expect(badge({ variant: 'outline' })).toBe('base v-outline s-sm');
  });

  it('applies compound variants when all keys match', () => {
    expect(badge({ variant: 'outline', size: 'lg' })).toBe('base v-outline s-lg compound');
  });

  it('appends className last', () => {
    expect(badge({ className: 'extra' })).toBe('base v-default s-sm extra');
  });

  it('falls back to defaults for null selections (cva parity)', () => {
    expect(badge({ size: null })).toBe('base v-default s-sm');
  });

  it('works without a config', () => {
    expect(cv('only-base')()).toBe('only-base');
  });
});

describe('attr() / boolAttr()', () => {
  it('falls back to the host attribute when the prop is unset', () => {
    const host = document.createElement('div');
    host.setAttribute('variant', 'outline');
    const prop = signal<string | undefined>(undefined);

    const resolved = attr(prop, host, 'variant');
    expect(resolved.value).toBe('outline');

    prop.value = 'ghost';
    expect(resolved.value).toBe('ghost');
  });

  it('returns undefined when neither prop nor attribute is set', () => {
    const host = document.createElement('div');
    expect(attr(signal<string | undefined>(undefined), host, 'variant').value).toBeUndefined();
  });

  it('boolAttr falls back to attribute presence', () => {
    const host = document.createElement('div');
    host.setAttribute('disabled', '');
    const prop = signal<boolean | undefined>(undefined);

    const resolved = boolAttr(prop, host, 'disabled');
    expect(resolved.value).toBe(true);

    prop.value = false;
    expect(resolved.value).toBe(false);
  });
});

describe('captureChildren()', () => {
  it('detaches and returns the host children in order', () => {
    const host = document.createElement('div');
    const icon = document.createElement('span');
    host.append(icon, 'text');

    const captured = captureChildren(host);

    expect(host.childNodes.length).toBe(0);
    expect(captured).toHaveLength(2);
    expect(captured[0]).toBe(icon);
    expect(captured[1]?.textContent).toBe('text');
  });
});
