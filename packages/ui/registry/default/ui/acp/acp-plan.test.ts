/**
 * acp-plan.test.ts — plan rendering.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AcpPlan } from './acp-plan.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

describe('AcpPlan', () => {
  it('renders one list item per entry, in order, with its status', () => {
    const container = mount(
      html`${AcpPlan({
        entries: [
          { content: 'read the code', status: 'completed' },
          { content: 'write the fix', status: 'in_progress' },
          { content: 'run the tests', status: 'pending' },
        ],
      })}`,
    );

    const items = container.querySelectorAll('[data-slot="acp-plan-entry"]');
    expect(items).toHaveLength(3);
    expect(Array.from(items).map((el) => el.getAttribute('data-status'))).toEqual([
      'completed',
      'in_progress',
      'pending',
    ]);
    expect(items[1]?.textContent).toContain('write the fix');
  });

  it('uses an ordered list so the plan reads as a sequence', () => {
    const container = mount(html`${AcpPlan({ entries: [{ content: 'x' }] })}`);
    expect(container.querySelector('[data-slot="acp-plan-list"]')?.tagName).toBe('OL');
  });

  it('defaults a missing status to pending', () => {
    const container = mount(html`${AcpPlan({ entries: [{ content: 'x' }] })}`);
    expect(
      container.querySelector('[data-slot="acp-plan-entry"]')?.getAttribute('data-status'),
    ).toBe('pending');
  });

  it('shows a completion count in the header', () => {
    const container = mount(
      html`${AcpPlan({
        entries: [
          { content: 'a', status: 'completed' },
          { content: 'b', status: 'pending' },
        ],
      })}`,
    );
    expect(container.querySelector('[data-slot="acp-plan-header"]')?.textContent).toContain('1/2');
  });

  it('omits the header when the label is empty', () => {
    const container = mount(html`${AcpPlan({ entries: [{ content: 'x' }], label: '' })}`);
    expect(container.querySelector('[data-slot="acp-plan-header"]')).toBeNull();
  });

  it('renders a priority badge only when a priority is given', () => {
    const container = mount(
      html`${AcpPlan({
        entries: [
          { content: 'urgent', priority: 'high' },
          { content: 'whenever' },
        ],
      })}`,
    );
    const badges = container.querySelectorAll('[data-slot="acp-plan-priority"]');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.textContent).toContain('high');
  });

  it('renders entry text as text', () => {
    const container = mount(html`${AcpPlan({ entries: [{ content: '<b>bold</b>' }] })}`);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>bold</b>');
  });
});
