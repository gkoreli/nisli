/**
 * acp-content.test.ts — content-block rendering and streaming stability.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { flush, html, signal, type TemplateResult } from '@nisli/core';
import { AcpContent, contentToText } from './acp-content.js';
import type { ContentBlock } from '../../lib/acp-protocol.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const text = (t: string): ContentBlock => ({ type: 'text', text: t });

describe('block types', () => {
  it('renders text preserving whitespace', () => {
    const container = mount(html`${AcpContent({ content: [text('a\n  b')] })}`);
    const node = container.querySelector('[data-slot="acp-content-text"]') as HTMLElement;
    expect(node.textContent).toContain('a\n  b');
    expect(node.className).toContain('whitespace-pre-wrap');
  });

  it('renders an image as a data URI', () => {
    const container = mount(
      html`${AcpContent({ content: [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }] })}`,
    );
    const img = container.querySelector('[data-slot="acp-content-image"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('renders a resource link with its title and a safe rel', () => {
    const container = mount(
      html`${AcpContent({
        content: [{ type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts', title: 'Entry point' }],
      })}`,
    );
    const link = container.querySelector('[data-slot="acp-content-resource-link"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Entry point');
    expect(link.getAttribute('rel')).toBe('noreferrer noopener');
  });

  it('renders embedded text resources, and labels binary ones', () => {
    const container = mount(
      html`${AcpContent({
        content: [
          { type: 'resource', resource: { uri: 'file:///a', text: 'inline' } },
          { type: 'resource', resource: { uri: 'file:///b', blob: 'AAAA' } },
        ],
      })}`,
    );
    const nodes = container.querySelectorAll('[data-slot="acp-content-resource"]');
    expect(nodes[0]?.textContent).toContain('inline');
    expect(nodes[1]?.textContent).toContain('binary');
  });

  it('renders an unmodelled block type visibly rather than as a blank row', () => {
    const container = mount(
      html`${AcpContent({ content: [{ type: 'hologram' } as unknown as ContentBlock] })}`,
    );
    expect(container.querySelector('[data-slot="acp-content-unknown"]')?.textContent).toContain(
      'hologram',
    );
  });
});

describe('untrusted input', () => {
  it('renders markup in text as text', () => {
    const container = mount(html`${AcpContent({ content: [text('<script>alert(1)</script>')] })}`);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('streaming stability', () => {
  it('patches text in place instead of rebuilding the node on every chunk', () => {
    const content = signal<ContentBlock[]>([text('Hel')]);
    const container = mount(html`${AcpContent({ content })}`);
    const before = container.querySelector('[data-slot="acp-content-text"]');

    // A merged text block is a NEW object each chunk — the node must survive it.
    content.value = [text('Hello')];
    flush();

    const after = container.querySelector('[data-slot="acp-content-text"]');
    expect(after).toBe(before);
    expect(after?.textContent).toContain('Hello');
  });
});

describe('contentToText', () => {
  it('flattens text and resource titles, skipping binary payloads', () => {
    expect(
      contentToText([
        text('hello '),
        { type: 'resource_link', uri: 'u', name: 'n', title: 'world' },
        { type: 'image', data: 'AAAA', mimeType: 'image/png' },
      ]),
    ).toBe('hello world');
  });

  it('returns an empty string for no content', () => {
    expect(contentToText(undefined)).toBe('');
  });
});
