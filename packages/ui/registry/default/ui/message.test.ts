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

  it('DOM regression (UI-60): message-content [data-slot] children are DESCENDANTS — align-end self-end reach needs `**:` (was `*:`, dead)', () => {
    const c = mount(
      html`${Message({
        align: 'end',
        children: MessageContent({ children: MessageHeader({ children: 'Ada' }) }),
      })}`,
    );
    flushEffects();
    const content = q(c, 'message-content');
    // The <ui-message-header> host sits between message-content and its painted
    // [data-slot=message-header] div → GRANDCHILD. So `*:data-slot` (child) was
    // dead and align-end never self-ended the content's slots (live symptom: the
    // avatar detached bottom-right). The `**:` descendant form reaches it.
    expect(content.querySelector(':scope > [data-slot="message-header"]')).toBeNull();
    expect(content.querySelector('ui-message-header > [data-slot="message-header"]')).not.toBeNull();
    expect(content.className).toContain('**:data-slot:self-end');
    expect(q(c, 'message').getAttribute('data-align')).toBe('end');
  });

  it('align="end" flips the row', () => {
    const c = mount(html`${Message({ align: 'end', children: 'Hi' })}`);
    flushEffects();
    const m = q(c, 'message');
    expect(m.getAttribute('data-align')).toBe('end');
    expect(m.className).toContain('data-[align=end]:flex-row-reverse');
  });
});

describe('Message — plain custom elements', () => {
  it('host is layout-transparent; styling lives on the inner element', () => {
    const c = mount(html`${Message({ children: '' })}`);
    flushEffects();
    const host = c.querySelector('ui-message') as HTMLElement;
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(host.querySelector('[data-slot="message"]')).not.toBeNull();
  });

  it('reads align from the host attribute', () => {
    const host = document.createElement('ui-message');
    host.setAttribute('align', 'end');
    document.body.appendChild(host);
    flushEffects();
    expect(host.querySelector('[data-slot="message"]')!.getAttribute('data-align')).toBe('end');
  });

  it('projects pre-existing light-DOM children into the inner root', () => {
    const host = document.createElement('ui-message-content');
    const span = document.createElement('span');
    span.textContent = 'Hi';
    host.append(span);
    document.body.appendChild(host);
    flushEffects();
    const content = host.querySelector('[data-slot="message-content"]')!;
    expect(content.contains(span)).toBe(true);
  });

  it('works via innerHTML parsing (children appended after upgrade)', async () => {
    document.body.innerHTML = '<ui-message-header>Ada</ui-message-header>';
    flushEffects();
    await Promise.resolve();
    expect(q(document.body, 'message-header').textContent).toBe('Ada');
  });

  it('explicit prop wins over the host attribute (align)', () => {
    const host = document.createElement('ui-message');
    host.setAttribute('align', 'start');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('align', 'end');
    document.body.appendChild(host);
    flushEffects();
    expect(host.querySelector('[data-slot="message"]')!.getAttribute('data-align')).toBe('end');
  });
});
