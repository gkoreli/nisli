/**
 * acp-permission.test.ts — the permission prompt's security-relevant behavior.
 *
 * These are not cosmetic assertions. Each one corresponds to a way a consent
 * dialog can betray the user: hiding what is being approved, making a standing
 * grant look like a one-time one, or resolving itself without a click.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { AcpPermission } from './acp-permission.js';
import type { PermissionOption, RequestPermissionOutcome, ToolCall } from '../../lib/acp-protocol.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const OPTIONS: PermissionOption[] = [
  { optionId: 'a1', name: 'Allow', kind: 'allow_once' },
  { optionId: 'a2', name: 'Allow all edits', kind: 'allow_always' },
  { optionId: 'r1', name: 'Reject', kind: 'reject_once' },
  { optionId: 'r2', name: 'Reject all', kind: 'reject_always' },
];

const WRITE_CALL: ToolCall = {
  toolCallId: 'c1',
  title: 'Write src/secrets.ts',
  kind: 'edit',
  status: 'pending',
  content: [{ type: 'diff', path: 'src/secrets.ts', oldText: 'const a = 1;', newText: 'const a = 2;' }],
};

function buttons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('[data-slot="acp-permission-option"]'));
}

describe('what is being approved', () => {
  it('renders the requested tool call expanded, so the diff is readable before consent', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);

    const details = container.querySelector('[data-slot="acp-tool-call"]') as HTMLDetailsElement;
    expect(details.hasAttribute('open')).toBe(true);
    // The actual change, not just the tool's name.
    expect(container.querySelector('[data-slot="acp-diff"]')).not.toBeNull();
    expect(container.textContent).toContain('src/secrets.ts');
    expect(container.textContent).toContain('const a = 2;');
  });

  it('renders an agent-authored title as text, never as markup', () => {
    const container = mount(
      html`${AcpPermission({
        toolCall: { toolCallId: 'c', title: '<img src=x onerror=alert(1)>' },
        options: OPTIONS,
      })}`,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('always-vs-once', () => {
  it('tags every option with its kind so styling cannot conflate them', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    expect(buttons(container).map((b) => b.dataset['kind'])).toEqual([
      'allow_once',
      'allow_always',
      'reject_once',
      'reject_always',
    ]);
  });

  it('gives allow_always a different class list than allow_once', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    const [once, always] = buttons(container);
    expect(always?.className).not.toBe(once?.className);
    // The one-time allow is the filled, primary affordance.
    expect(once?.className).toContain('bg-primary');
    expect(always?.className).not.toContain('bg-primary ');
  });

  it('explains the standing grant when a persistent option is offered', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    expect(container.querySelector('[data-slot="acp-permission-note"]')?.textContent).toContain(
      'rest of this session',
    );
  });

  it('omits that note when only one-time options are offered', () => {
    const container = mount(
      html`${AcpPermission({
        toolCall: WRITE_CALL,
        options: [OPTIONS[0]!, OPTIONS[2]!],
      })}`,
    );
    expect(container.querySelector('[data-slot="acp-permission-note"]')).toBeNull();
  });
});

describe('no accidental consent', () => {
  it('autofocuses nothing', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    expect(container.querySelector('[autofocus]')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('uses type=button so a stray Enter cannot submit an enclosing form', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    expect(buttons(container).every((b) => b.getAttribute('type') === 'button')).toBe(true);
  });

  it('emits nothing until a button is actually clicked', () => {
    const onSelect = vi.fn();
    mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS, onSelect })}`);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores clicks while disabled, so an in-flight answer cannot be double-sent', () => {
    const onSelect = vi.fn();
    const container = mount(
      html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS, disabled: true, onSelect })}`,
    );
    buttons(container)[0]?.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('outcome reporting', () => {
  it('reports the selected optionId in ACP outcome shape', () => {
    const onSelect = vi.fn();
    const container = mount(
      html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS, onSelect })}`,
    );
    buttons(container)[1]?.click();
    expect(onSelect).toHaveBeenCalledWith({ outcome: 'selected', optionId: 'a2' });
  });

  it('dispatches a bubbling ui-acp-permission-select event with the same detail', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    const seen: RequestPermissionOutcome[] = [];
    document.addEventListener('ui-acp-permission-select', (event) => {
      seen.push((event as CustomEvent<RequestPermissionOutcome>).detail);
    });

    buttons(container)[2]?.click();
    expect(seen).toEqual([{ outcome: 'selected', optionId: 'r1' }]);
  });

  it('is announced to assistive tech as a blocking dialog', () => {
    const container = mount(html`${AcpPermission({ toolCall: WRITE_CALL, options: OPTIONS })}`);
    const root = container.querySelector('[data-slot="acp-permission"]') as HTMLElement;
    expect(root.getAttribute('role')).toBe('alertdialog');
    expect(root.getAttribute('aria-label')).toBe('Permission required');
  });
});
