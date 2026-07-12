/**
 * attachment.test.ts — attachment chip variants + parts.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from './attachment.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}
const q = (root: ParentNode, slot: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;

describe('Attachment', () => {
  it('renders the chip with default state/size/orientation and parts', () => {
    const c = mount(
      html`${AttachmentGroup({
        children: Attachment({
          children: html`${AttachmentMedia({ variant: 'icon', children: '📄' })}
          ${AttachmentContent({
            children: html`${AttachmentTitle({ children: 'report.pdf' })}
            ${AttachmentDescription({ children: '2.4 MB' })}`,
          })}
          ${AttachmentActions({ children: AttachmentAction({ children: '✕' }) })}
          ${AttachmentTrigger({})}`,
        }),
      })}`,
    );
    flushEffects();
    expect(q(c, 'attachment-group').className).toContain('overflow-x-auto');
    const a = q(c, 'attachment');
    expect(a.getAttribute('data-state')).toBe('done');
    expect(a.getAttribute('data-size')).toBe('default');
    expect(a.getAttribute('data-orientation')).toBe('horizontal');
    expect(q(c, 'attachment-media').getAttribute('data-variant')).toBe('icon');
    expect(q(c, 'attachment-title').tagName).toBe('SPAN');
    expect(q(c, 'attachment-title').textContent).toBe('report.pdf');
    expect(q(c, 'attachment-description').textContent).toBe('2.4 MB');
    const action = q(c, 'attachment-action');
    expect(action.tagName).toBe('BUTTON');
    expect(action.getAttribute('type')).toBe('button');
    const trigger = q(c, 'attachment-trigger');
    expect(trigger.className).toContain('absolute inset-0');
  });

  it('reflects state/size/orientation variants', () => {
    const c = mount(
      html`${Attachment({ state: 'error', size: 'xs', orientation: 'vertical', children: '' })}`,
    );
    flushEffects();
    const a = q(c, 'attachment');
    expect(a.getAttribute('data-state')).toBe('error');
    expect(a.getAttribute('data-size')).toBe('xs');
    expect(a.getAttribute('data-orientation')).toBe('vertical');
    expect(a.className).toContain('data-[state=error]:border-destructive/30');
  });

  it('media image variant carries the image classes', () => {
    const c = mount(html`${AttachmentMedia({ variant: 'image', children: '' })}`);
    flushEffects();
    const m = q(c, 'attachment-media');
    expect(m.getAttribute('data-variant')).toBe('image');
    expect(m.className).toContain('object-cover');
  });
});

describe('AttachmentAction / AttachmentTrigger — native button contract', () => {
  it('the action reuses the canonical button variants (ghost / icon-xs default)', () => {
    const c = mount(html`${AttachmentAction({ children: '✕' })}`);
    flushEffects();
    const btn = q(c, 'attachment-action');
    // buttonVariants(ghost) base + icon-xs sizing tokens.
    expect(btn.className).toContain('hover:bg-accent'); // ghost
    expect(btn.className).toContain('size-6'); // icon-xs
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('the action forwards aria-label / disabled / type to the inner button', () => {
    const c = mount(
      html`${AttachmentAction({ ariaLabel: 'Remove file', disabled: true, type: 'submit', children: '✕' })}`,
    );
    flushEffects();
    const btn = q(c, 'attachment-action');
    expect(btn.getAttribute('aria-label')).toBe('Remove file');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.getAttribute('type')).toBe('submit');
  });

  it('the action honours variant / size overrides', () => {
    const c = mount(html`${AttachmentAction({ variant: 'destructive', size: 'sm', children: '✕' })}`);
    flushEffects();
    const btn = q(c, 'attachment-action');
    expect(btn.className).toContain('bg-destructive');
    expect(btn.className).toContain('h-8'); // size sm
  });

  it('the trigger forwards aria-label / disabled / type', () => {
    const c = mount(
      html`${AttachmentTrigger({ ariaLabel: 'Open attachment', disabled: true, type: 'submit' })}`,
    );
    flushEffects();
    const t = q(c, 'attachment-trigger');
    expect(t.getAttribute('aria-label')).toBe('Open attachment');
    expect(t.hasAttribute('disabled')).toBe(true);
    expect(t.getAttribute('type')).toBe('submit');
  });
});

describe('Attachment — plain custom elements', () => {
  it('host is layout-transparent; styling lives on the inner element', () => {
    const c = mount(html`${Attachment({ children: '' })}`);
    flushEffects();
    const host = c.querySelector('ui-attachment') as HTMLElement;
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(host.querySelector('[data-slot="attachment"]')).not.toBeNull();
  });

  it('reads state/size/orientation from host attributes', () => {
    const host = document.createElement('ui-attachment');
    host.setAttribute('state', 'error');
    host.setAttribute('size', 'xs');
    host.setAttribute('orientation', 'vertical');
    document.body.appendChild(host);
    flushEffects();
    const a = host.querySelector('[data-slot="attachment"]')!;
    expect(a.getAttribute('data-state')).toBe('error');
    expect(a.getAttribute('data-size')).toBe('xs');
    expect(a.getAttribute('data-orientation')).toBe('vertical');
  });

  it('forwards the aria-label host attribute onto the inner action button', () => {
    const host = document.createElement('ui-attachment-action');
    host.setAttribute('aria-label', 'Remove');
    document.body.appendChild(host);
    flushEffects();
    expect(host.querySelector('[data-slot="attachment-action"]')!.getAttribute('aria-label')).toBe(
      'Remove',
    );
  });

  it('projects pre-existing light-DOM children into the inner action button', () => {
    const host = document.createElement('ui-attachment-action');
    const icon = document.createElement('span');
    icon.textContent = '✕';
    host.append(icon);
    document.body.appendChild(host);
    flushEffects();
    const btn = host.querySelector('[data-slot="attachment-action"]')!;
    expect(btn.contains(icon)).toBe(true);
  });

  it('works via innerHTML parsing (children appended after upgrade)', async () => {
    document.body.innerHTML = '<ui-attachment-title>report.pdf</ui-attachment-title>';
    flushEffects();
    await Promise.resolve();
    const title = q(document.body, 'attachment-title');
    expect(title.textContent).toBe('report.pdf');
  });

  it('explicit prop wins over the host attribute (action size)', () => {
    const host = document.createElement('ui-attachment-action');
    host.setAttribute('size', 'sm');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('size', 'icon-xs');
    document.body.appendChild(host);
    flushEffects();
    const btn = host.querySelector('[data-slot="attachment-action"]')!;
    expect(btn.className).toContain('size-6'); // icon-xs wins
    expect(btn.className).not.toContain('h-8'); // not sm
  });
});

describe('Attachment — live attributes (UI-30 attrs{})', () => {
  it('reacts to post-mount state / size / orientation on the chip', () => {
    const host = document.createElement('ui-attachment');
    document.body.appendChild(host);
    flushEffects();
    const el = host.querySelector('[data-slot="attachment"]')!;
    expect(el.getAttribute('data-state')).toBe('done');
    expect(el.getAttribute('data-size')).toBe('default');
    expect(el.getAttribute('data-orientation')).toBe('horizontal');

    host.setAttribute('state', 'error');
    host.setAttribute('size', 'sm');
    host.setAttribute('orientation', 'vertical');
    flushEffects();
    expect(el.getAttribute('data-state')).toBe('error');
    expect(el.getAttribute('data-size')).toBe('sm');
    expect(el.getAttribute('data-orientation')).toBe('vertical');
    expect(el.className).toContain('w-24'); // vertical variant class applied live
  });

  it('reacts to a post-mount disabled toggle on the action button', () => {
    const host = document.createElement('ui-attachment-action');
    document.body.appendChild(host);
    flushEffects();
    const btn = host.querySelector('[data-slot="attachment-action"]') as HTMLButtonElement;
    expect(btn.hasAttribute('disabled')).toBe(false);

    host.setAttribute('disabled', '');
    flushEffects();
    expect(btn.hasAttribute('disabled')).toBe(true);

    // Our boolean semantics: literal "false" → false, live.
    host.setAttribute('disabled', 'false');
    flushEffects();
    expect(btn.hasAttribute('disabled')).toBe(false);
  });
});
