/**
 * utils.test.ts — cn()/cv() class utilities and interop helpers.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { signal } from '@nisli/core';
import { attr, boolAttr, captureChildren, cn, cv, projectChildren } from './utils.js';

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

  it('boolAttr uses defaultValue when the attribute is absent', () => {
    const host = document.createElement('div');
    const prop = signal<boolean | undefined>(undefined);

    // default-false flag (e.g. disabled): absent → false
    expect(boolAttr(prop, host, 'disabled').value).toBe(false);
    // default-true flag (e.g. decorative): absent → true
    expect(boolAttr(prop, host, 'decorative', true).value).toBe(true);
  });

  it('boolAttr coerces the literal string "false" to false (opt-out)', () => {
    const host = document.createElement('div');
    host.setAttribute('decorative', 'false');
    const prop = signal<boolean | undefined>(undefined);

    // Lets a default-true flag be opted out of from plain HTML.
    expect(boolAttr(prop, host, 'decorative', true).value).toBe(false);
  });

  it('boolAttr treats any non-"false" attribute value as true (opt-in)', () => {
    const host = document.createElement('div');
    host.setAttribute('disabled', ''); // bare attribute
    host.setAttribute('checked', 'checked'); // non-empty value
    const prop = signal<boolean | undefined>(undefined);

    expect(boolAttr(prop, host, 'disabled').value).toBe(true);
    expect(boolAttr(prop, host, 'checked').value).toBe(true);
  });

  it('boolAttr lets an explicit prop win over the attribute fallback', () => {
    const host = document.createElement('div');
    host.setAttribute('decorative', 'false');

    // Explicit true prop beats the "false" attribute.
    expect(boolAttr(signal<boolean | undefined>(true), host, 'decorative', true).value).toBe(
      true,
    );
    // Explicit false prop beats a default-true / bare-attr fallback.
    expect(boolAttr(signal<boolean | undefined>(false), host, 'missing', true).value).toBe(
      false,
    );
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

describe('projectChildren()', () => {
  it('appends captured children immediately into the root', () => {
    const host = document.createElement('div');
    const root = document.createElement('div');
    host.append(root);
    const a = document.createElement('span');
    const b = document.createElement('span');

    projectChildren(host, root, [a, b]);

    expect(root.contains(a)).toBe(true);
    expect(root.contains(b)).toBe(true);
  });

  it('sweeps parser-appended host children into the root on a microtask', async () => {
    const host = document.createElement('div');
    const root = document.createElement('div');
    host.append(root);

    projectChildren(host, root, []);
    // Simulate a streaming parser appending a child after upgrade.
    const late = document.createElement('span');
    host.append(late);

    await Promise.resolve();
    expect(root.contains(late)).toBe(true);
  });

  it('never appends an ancestor of the root (nested-component guard)', async () => {
    // Reproduces the nested case where a parent sweep has already moved a
    // child host — and the root inside it — so host.childNodes contains a
    // node that already contains root. Appending it would throw.
    const host = document.createElement('div');
    const wrapper = document.createElement('div');
    const root = document.createElement('span');
    wrapper.append(root);
    host.append(wrapper); // host.childNodes = [wrapper], wrapper contains root

    expect(() => projectChildren(host, root, [])).not.toThrow();
    await Promise.resolve();

    // The guard skipped the ancestor; nothing moved, no exception.
    expect(root.parentElement).toBe(wrapper);
  });
});
