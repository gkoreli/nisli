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
