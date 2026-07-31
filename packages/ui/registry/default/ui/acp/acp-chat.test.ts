/**
 * acp-chat.test.ts — the composed chat: composer semantics and busy state.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush, html, signal, type TemplateResult } from '@nisli/core';
import { AcpChat } from './acp-chat.js';
import { createTranscript } from '../../lib/acp-session.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const input = (c: HTMLElement) =>
  c.querySelector('[data-slot="acp-chat-input"]') as HTMLTextAreaElement;
const send = (c: HTMLElement) =>
  c.querySelector('[data-slot="acp-chat-send"]') as HTMLButtonElement;

function type(c: HTMLElement, text: string): void {
  const el = input(c);
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flush();
}

function pressEnter(c: HTMLElement, init: KeyboardEventInit = {}): void {
  input(c).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }),
  );
  flush();
}

describe('composer', () => {
  it('sends the trimmed prompt via callback and bubbling event, then clears', () => {
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ onPrompt })}`);
    const events: string[] = [];
    document.addEventListener('ui-acp-prompt', (e) => events.push((e as CustomEvent<string>).detail));

    type(container, '  fix the resolver  ');
    send(container).click();
    flush();

    expect(onPrompt).toHaveBeenCalledWith('fix the resolver');
    expect(events).toEqual(['fix the resolver']);
    expect(input(container).value).toBe('');
  });

  it('never sends an empty or whitespace-only prompt', () => {
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ onPrompt })}`);

    expect(send(container).disabled).toBe(true);
    type(container, '   ');
    expect(send(container).disabled).toBe(true);
    pressEnter(container);
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('Enter sends; Shift+Enter and IME-composition Enter do not', () => {
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ onPrompt })}`);

    type(container, 'line one');
    pressEnter(container, { shiftKey: true });
    expect(onPrompt).not.toHaveBeenCalled();

    pressEnter(container, { isComposing: true });
    expect(onPrompt).not.toHaveBeenCalled();

    pressEnter(container);
    expect(onPrompt).toHaveBeenCalledWith('line one');
  });
});

describe('busy: queue mode (default)', () => {
  it('never disables the input — ACP does not queue for you, the client does', () => {
    const busy = signal(true);
    const container = mount(html`${AcpChat({ busy })}`);
    expect(input(container).disabled).toBe(false);
  });

  it('queues a prompt submitted mid-turn and sends it when the turn ends', async () => {
    const busy = signal(true);
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ busy, onPrompt })}`);

    type(container, 'follow-up');
    pressEnter(container);

    // Held, visibly, not sent.
    expect(onPrompt).not.toHaveBeenCalled();
    const queued = container.querySelector('[data-slot="acp-chat-queued"]');
    expect(queued?.textContent).toContain('follow-up');
    expect(send(container).textContent).toContain('Queue');

    busy.value = false;
    flush();
    await Promise.resolve(); // the drain is deferred a microtask
    flush();

    expect(onPrompt).toHaveBeenCalledWith('follow-up');
    expect(container.querySelector('[data-slot="acp-chat-queued"]')).toBeNull();
  });

  it('drains one queued prompt per turn end, in order', async () => {
    const onPrompt = vi.fn(() => (busy.value = true));
    const busy = signal(true);
    const container = mount(html`${AcpChat({ busy, onPrompt })}`);

    type(container, 'first');
    pressEnter(container);
    type(container, 'second');
    pressEnter(container);
    expect(container.querySelectorAll('[data-slot="acp-chat-queued"]')).toHaveLength(2);

    busy.value = false;
    flush();
    await Promise.resolve();
    flush();
    expect(onPrompt).toHaveBeenCalledTimes(1);
    expect(onPrompt).toHaveBeenCalledWith('first');
    // The drained prompt set busy again; 'second' waits for the next turn end.
    expect(container.querySelectorAll('[data-slot="acp-chat-queued"]')).toHaveLength(1);

    busy.value = false;
    flush();
    await Promise.resolve();
    expect(onPrompt).toHaveBeenCalledWith('second');
  });

  it('a queued prompt can be removed before it sends', async () => {
    const busy = signal(true);
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ busy, onPrompt })}`);

    type(container, 'never mind');
    pressEnter(container);
    (container.querySelector('[data-slot="acp-chat-queued-remove"]') as HTMLButtonElement).click();
    flush();
    expect(container.querySelector('[data-slot="acp-chat-queued"]')).toBeNull();

    busy.value = false;
    flush();
    await Promise.resolve();
    expect(onPrompt).not.toHaveBeenCalled();
  });

  it('shows Cancel beside Send while busy when onCancel is provided', () => {
    const busy = signal(true);
    const onCancel = vi.fn();
    const container = mount(html`${AcpChat({ busy, onCancel })}`);

    expect(send(container)).not.toBeNull();
    const cancel = container.querySelector('[data-slot="acp-chat-cancel"]') as HTMLButtonElement;
    cancel.click();
    expect(onCancel).toHaveBeenCalledOnce();

    busy.value = false;
    flush();
    expect(container.querySelector('[data-slot="acp-chat-cancel"]')).toBeNull();
  });
});

describe('busy: steer mode', () => {
  it('fires the prompt immediately mid-turn', () => {
    const busy = signal(true);
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ busy, onPrompt, mode: 'steer' })}`);

    type(container, 'focus on the tests instead');
    pressEnter(container);

    expect(onPrompt).toHaveBeenCalledWith('focus on the tests instead');
    expect(container.querySelector('[data-slot="acp-chat-queued"]')).toBeNull();
  });

  it('shows the toggle only when steerable, and flipping it changes delivery', async () => {
    const busy = signal(true);
    const onPrompt = vi.fn();
    const plain = mount(html`${AcpChat({ busy, onPrompt })}`);
    expect(plain.querySelector('[data-slot="acp-chat-mode-toggle"]')).toBeNull();

    document.body.innerHTML = '';
    const container = mount(html`${AcpChat({ busy, onPrompt, steerable: true })}`);
    const toggle = container.querySelector('[data-slot="acp-chat-mode-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    toggle.click();
    flush();
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    type(container, 'redirect');
    pressEnter(container);
    expect(onPrompt).toHaveBeenCalledWith('redirect'); // steered, not queued

    toggle.click();
    flush();
    type(container, 'later');
    pressEnter(container);
    expect(onPrompt).toHaveBeenCalledTimes(1); // back to queueing
    expect(container.querySelector('[data-slot="acp-chat-queued"]')?.textContent).toContain('later');
  });
});

describe('composition with the reducer', () => {
  it('renders live transcript entries and the empty state', () => {
    const transcript = createTranscript();
    const container = mount(
      html`${AcpChat({ entries: transcript.entries, empty: 'Say hello.' })}`,
    );
    expect(container.textContent).toContain('Say hello.');

    transcript.apply({
      sessionUpdate: 'user_message_chunk',
      content: { type: 'text', text: 'hello agent' },
    });
    flush();

    expect(container.querySelector('[data-slot="acp-transcript-empty"]')).toBeNull();
    expect(container.textContent).toContain('hello agent');
  });
});
