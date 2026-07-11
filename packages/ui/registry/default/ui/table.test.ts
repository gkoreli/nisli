/**
 * table.test.ts — Table parts render real table DOM.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table.js';

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

describe('Table', () => {
  it('wraps a real <table> in an overflow container', () => {
    const c = mount(html`${Table({ children: '' })}`);
    const wrap = bySlot('table-container', c);
    const table = bySlot('table', c);

    expect(wrap.className).toContain('overflow-x-auto');
    expect(table.tagName).toBe('TABLE');
    expect(table.className).toContain('caption-bottom');
    expect(wrap.contains(table)).toBe(true);
  });

  it('hosts are layout-transparent', () => {
    const c = mount(html`${Table({ children: '' })}`);
    expect((c.querySelector('ui-table') as HTMLElement).style.display).toBe('contents');
  });

  it('composes real thead/tbody/tr/th/td elements via factories', () => {
    const c = mount(
      html`${Table({
        children: html`${TableCaption({ children: 'Users' })}${TableHeader({
          children: TableRow({
            children: html`${TableHead({ children: 'Name' })}${TableHead({ children: 'Role' })}`,
          }),
        })}${TableBody({
          children: TableRow({
            children: html`${TableCell({ children: 'Ada' })}${TableCell({ children: 'Admin' })}`,
          }),
        })}`,
      })}`,
    );

    const table = bySlot('table', c);
    // Real table elements are rendered (the display:contents hosts collapse in
    // the box/layout tree, which is what CSS table layout + a11y consume).
    const caption = table.querySelector('caption') as HTMLElement;
    expect(caption.textContent).toBe('Users');

    const heads = table.querySelectorAll('thead th');
    expect(heads.length).toBe(2);
    expect(heads[0].tagName).toBe('TH');
    expect(heads[0].textContent).toBe('Name');

    const cells = table.querySelectorAll('tbody td');
    expect(cells.length).toBe(2);
    expect(cells[0].tagName).toBe('TD');
    expect(cells[0].textContent).toBe('Ada');
  });

  it('renders a real <tfoot>', () => {
    const c = mount(
      html`${Table({
        children: TableFooter({
          children: TableRow({ children: TableCell({ children: 'Total' }) }),
        }),
      })}`,
    );
    const table = bySlot('table', c);
    const tfoot = table.querySelector('tfoot') as HTMLElement;
    expect(tfoot).not.toBeNull();
    expect(tfoot.textContent).toBe('Total');
    expect(bySlot('table-footer', c).className).toContain('bg-muted/50');
  });

  it('merges className last on a part', () => {
    const c = mount(html`${Table({ children: TableRow({ className: 'cursor-pointer', children: TableCell({ children: 'x' }) }) })}`);
    expect(bySlot('table-row', c).className.endsWith('cursor-pointer')).toBe(true);
  });
});
