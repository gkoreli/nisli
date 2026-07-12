/**
 * avatar.test.ts — Avatar image load state + fallback swapping.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from './avatar.js';

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

describe('AvatarBadge', () => {
  it('renders a badge span inside an avatar with the verbatim positioning classes', () => {
    const c = mount(
      html`${Avatar({
        children: html`${AvatarImage({ src: '/me.jpg' })}${AvatarBadge({ children: '' })}`,
      })}`,
    );
    const badge = bySlot('avatar-badge', c);
    expect(badge.tagName).toBe('SPAN');
    // Positioned bottom-right, primary, and sized by the ancestor avatar's size.
    expect(badge.className).toContain('absolute');
    expect(badge.className).toContain('bg-primary');
    expect(badge.className).toContain('ring-background');
    expect(badge.className).toContain('group-data-[size=default]/avatar:size-2.5');
  });

  it('is layout-transparent and merges className', () => {
    const c = mount(html`${AvatarBadge({ className: 'custom-badge', children: '3' })}`);
    expect((c.querySelector('ui-avatar-badge') as HTMLElement).style.display).toBe('contents');
    const badge = bySlot('avatar-badge', c);
    expect(badge.className).toContain('custom-badge');
    expect(badge.textContent).toBe('3');
  });
});

describe('AvatarGroup / AvatarGroupCount', () => {
  it('renders an overlapping group wrapper with descendant-targeted overlap + ring', () => {
    const c = mount(
      html`${AvatarGroup({
        children: html`${Avatar({ children: AvatarFallback({ children: 'AB' }) })}
        ${Avatar({ children: AvatarFallback({ children: 'CD' }) })}`,
      })}`,
    );
    const group = bySlot('avatar-group', c);
    expect(group.tagName).toBe('DIV');
    expect(group.className).toContain('group/avatar-group');
    // PLATFORM TRANSLATION: upstream's DIRECT-CHILD utilities are retargeted to the
    // boxed DESCENDANT (the ui-avatar host is display:contents → no box to paint a
    // ring on / take a margin). Overlap → negative inline-start margin on the inner
    // box of every non-first child; ring → the `**:` descendant variant.
    expect(group.className).toContain('[&>*:not(:first-child)>*]:-ms-2');
    expect(group.className).toContain('**:data-[slot=avatar]:ring-2');
    expect(group.className).toContain('**:data-[slot=avatar]:ring-background');
    // The dead direct-child overlap must be gone (`**:` legitimately contains the
    // `*:` substring, so the ring form is asserted positively above, not negated).
    expect(group.className).not.toContain('-space-x-2');
    // Both avatars project into the group.
    expect(group.querySelectorAll('[data-slot="avatar"]').length).toBe(2);
  });

  it('DOM regression: the slot-bearing [data-slot=avatar] is a DESCENDANT, not a direct child (why *: is dead, **: is required)', () => {
    const c = mount(
      html`${AvatarGroup({
        children: html`${Avatar({ children: AvatarFallback({ children: 'AB' }) })}
        ${Avatar({ children: AvatarFallback({ children: 'CD' }) })}`,
      })}`,
    );
    const group = bySlot('avatar-group', c);
    // The direct children of the group are the layout-transparent <ui-avatar>
    // HOSTS — NOT the [data-slot="avatar"] divs. So upstream's `*:` (`& > *`)
    // child combinator matches nothing with the slot, which is exactly why it is
    // dead through the host and the descendant `**:` is required.
    expect(group.querySelector(':scope > [data-slot="avatar"]')).toBeNull();
    expect(group.querySelectorAll(':scope > ui-avatar').length).toBe(2);
    // The boxed slot element is reachable one level deeper — a DESCENDANT that the
    // `**:` / `[&>*:not(:first-child)>*]` selectors correctly target.
    const first = group.querySelector('ui-avatar > [data-slot="avatar"]');
    expect(first).not.toBeNull();
    expect((first as HTMLElement).parentElement!.tagName.toLowerCase()).toBe('ui-avatar');
  });

  it('renders the +N overflow count chip with the verbatim classes', () => {
    const c = mount(html`${AvatarGroupCount({ children: '+3' })}`);
    const count = bySlot('avatar-group-count', c);
    expect(count.tagName).toBe('DIV');
    expect(count.textContent).toBe('+3');
    expect(count.className).toContain('bg-muted');
    expect(count.className).toContain('ring-background');
    expect(count.className).toContain('group-has-data-[size=lg]/avatar-group:size-10');
  });

  it('group and count hosts are layout-transparent', () => {
    const c = mount(
      html`${AvatarGroup({ children: AvatarGroupCount({ children: '+2' }) })}`,
    );
    expect((c.querySelector('ui-avatar-group') as HTMLElement).style.display).toBe('contents');
    expect((c.querySelector('ui-avatar-group-count') as HTMLElement).style.display).toBe(
      'contents',
    );
  });
});
