/**
 * avatar.test.ts — Avatar image load state + fallback swapping.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import { Avatar, AvatarImage, AvatarFallback } from './avatar.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function bySlot(slot: string, container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector(`[data-slot="${slot}"]`);
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/** An avatar with an image + fallback; returns its container. */
function avatar(props: Record<string, unknown> = {}, src = '/me.jpg'): HTMLElement {
  return mount(
    html`${Avatar({
      ...props,
      children: html`${AvatarImage({ src, alt: 'Me' })}${AvatarFallback({ children: 'ME' })}`,
    })}`,
  );
}

describe('Avatar', () => {
  it('renders a sized rounded root with data-size', () => {
    const c = mount(html`${Avatar({ size: 'lg', children: '' })}`);
    const root = bySlot('avatar', c);
    expect(root.getAttribute('data-size')).toBe('lg');
    expect(root.className).toContain('rounded-full');
    expect(root.className).toContain('data-[size=lg]:size-10');
  });

  it('hosts are layout-transparent', () => {
    const c = avatar();
    expect((c.querySelector('ui-avatar') as HTMLElement).style.display).toBe('contents');
  });

  it('shows the fallback and hides the image before load', () => {
    const c = avatar();
    const img = bySlot('avatar-image', c) as HTMLImageElement;
    const fallback = bySlot('avatar-fallback', c);

    expect(img.getAttribute('src')).toBe('/me.jpg');
    expect(img.hidden).toBe(true);
    expect(fallback.hidden).toBe(false);
    expect(fallback.textContent).toBe('ME');
  });

  it('reveals the image and hides the fallback once it loads', () => {
    const c = avatar();
    const img = bySlot('avatar-image', c) as HTMLImageElement;

    img.dispatchEvent(new Event('load'));
    flushEffects();

    expect(img.hidden).toBe(false);
    expect(bySlot('avatar-fallback', c).hidden).toBe(true);
  });

  it('keeps the fallback when the image errors', () => {
    const c = avatar({}, '/broken.jpg');
    const img = bySlot('avatar-image', c) as HTMLImageElement;

    img.dispatchEvent(new Event('error'));
    flushEffects();

    expect(img.hidden).toBe(true);
    expect(bySlot('avatar-fallback', c).hidden).toBe(false);
  });

  it('shows only a fallback when there is no image', () => {
    const c = mount(html`${Avatar({ children: AvatarFallback({ children: 'AB' }) })}`);
    const fallback = bySlot('avatar-fallback', c);
    expect(fallback.hidden).toBe(false);
    expect(fallback.textContent).toBe('AB');
  });
});

describe('Avatar parts outside a root', () => {
  it('render the setup error boundary instead of a stray element', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${AvatarImage({ src: '/x.jpg' })}`);

    expect(c.querySelector('[data-slot="avatar-image"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
