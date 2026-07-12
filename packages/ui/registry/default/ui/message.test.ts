/**
 * message.test.ts — chat message row structure.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from './message.js';

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

describe('Message', () => {
  it('renders the message parts with data-slot hooks and default start align', () => {
    const c = mount(
      html`${MessageGroup({
        children: Message({
          children: html`${MessageAvatar({ children: 'A' })}
          ${MessageContent({
            children: html`${MessageHeader({ children: 'Ada' })}
            <div>Hello</div>
            ${MessageFooter({ children: '2:30 PM' })}`,
          })}`,
        }),
      })}`,
    );
    flushEffects();
    expect(q(c, 'message-group').tagName).toBe('DIV');
    expect(q(c, 'message').getAttribute('data-align')).toBe('start');
    expect(q(c, 'message-avatar').textContent).toBe('A');
    expect(q(c, 'message-content').className).toContain('flex-col');
    expect(q(c, 'message-header').textContent).toBe('Ada');
    expect(q(c, 'message-footer').textContent).toBe('2:30 PM');
  });

  it('align="end" flips the row', () => {
    const c = mount(html`${Message({ align: 'end', children: 'Hi' })}`);
    flushEffects();
    const m = q(c, 'message');
    expect(m.getAttribute('data-align')).toBe('end');
    expect(m.className).toContain('data-[align=end]:flex-row-reverse');
  });
});
