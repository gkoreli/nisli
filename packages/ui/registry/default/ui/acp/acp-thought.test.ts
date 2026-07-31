/**
 * acp-thought.test.ts — reasoning disclosure.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AcpThought } from './acp-thought.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const text = (t: string) => ({ type: 'text' as const, text: t });

describe('AcpThought', () => {
  it('stays collapsed by default so reasoning does not dominate the transcript', () => {
    const container = mount(html`${AcpThought({ content: [text('long reasoning')] })}`);
    const details = container.querySelector('[data-slot="acp-thought"]') as HTMLDetailsElement;
    expect(details.hasAttribute('open')).toBe(false);
  });

  it('still renders the reasoning in the body for when it is expanded', () => {
    const container = mount(html`${AcpThought({ content: [text('because X')] })}`);
    expect(container.querySelector('[data-slot="acp-thought-body"]')?.textContent).toContain(
      'because X',
    );
  });

  it('shows the live tail while streaming, so progress is visible collapsed', () => {
    const container = mount(
      html`${AcpThought({ content: [text('step one\nstep two')], streaming: true })}`,
    );
    const tail = container.querySelector('[data-slot="acp-thought-tail"]') as HTMLElement;
    expect(tail.textContent).toContain('step two');
    expect(tail.textContent).not.toContain('step one');
  });

  it('drops the tail once streaming settles', () => {
    const container = mount(
      html`${AcpThought({ content: [text('done thinking')], streaming: false })}`,
    );
    expect(container.querySelector('[data-slot="acp-thought-tail"]')?.textContent?.trim()).toBe('');
  });

  it('exposes streaming state as a data attribute', () => {
    const container = mount(html`${AcpThought({ content: [text('x')], streaming: true })}`);
    expect(
      container.querySelector('[data-slot="acp-thought"]')?.getAttribute('data-streaming'),
    ).not.toBeNull();
  });

  it('truncates a very long tail from the left, keeping the newest text', () => {
    const long = 'x'.repeat(200) + 'END';
    const container = mount(html`${AcpThought({ content: [text(long)], streaming: true })}`);
    const tail = container.querySelector('[data-slot="acp-thought-tail"]')?.textContent ?? '';
    expect(tail).toContain('END');
    expect(tail.length).toBeLessThan(long.length);
  });
});
