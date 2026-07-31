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

describe('busy state', () => {
  it('disables the composer while a turn is in flight', () => {
    const busy = signal(false);
    const onPrompt = vi.fn();
    const container = mount(html`${AcpChat({ busy, onPrompt })}`);

    type(container, 'go');
    busy.value = true;
    flush();

    expect(input(container).disabled).toBe(true);
    pressEnter(container);
    expect(onPrompt).not.toHaveBeenCalled();

    busy.value = false;
    flush();
    expect(input(container).disabled).toBe(false);
  });

  it('swaps Send for Cancel while busy when onCancel is provided', () => {
    const busy = signal(true);
    const onCancel = vi.fn();
    const container = mount(html`${AcpChat({ busy, onCancel })}`);

    expect(send(container)).toBeNull();
    const cancel = container.querySelector('[data-slot="acp-chat-cancel"]') as HTMLButtonElement;
    cancel.click();
    expect(onCancel).toHaveBeenCalledOnce();

    busy.value = false;
    flush();
    expect(container.querySelector('[data-slot="acp-chat-cancel"]')).toBeNull();
    expect(send(container)).not.toBeNull();
  });

  it('keeps Send (disabled) while busy when no onCancel is given', () => {
    const container = mount(html`${AcpChat({ busy: true })}`);
    expect(container.querySelector('[data-slot="acp-chat-cancel"]')).toBeNull();
    expect(send(container).disabled).toBe(true);
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
