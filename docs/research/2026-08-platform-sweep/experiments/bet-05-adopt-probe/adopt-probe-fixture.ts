/**
 * adopt-probe-fixture.ts — the minimal P1-style `adopt` branch under test.
 *
 * Loaded into the page BEFORE the component module (that ordering is the whole
 * experiment: step 2 of reviews/bet-05-adopt-islands.review.md:170). It imports
 * NOTHING from @nisli/core, so the browser's only runtime instance is the one
 * the separately bundled component module brings — an "independently loaded
 * component module", per the riskiest assumption being falsified.
 *
 * It implements the brief's Phase 1 order (briefs/bet-05-adopt-islands.md:48-56)
 * with the one deviation core forces today: because `connectedCallback` has no
 * adopt hook (packages/core/src/component.ts:466-516), the prior render output
 * must be cleared BEFORE `customElements.define()` upgrades the host, otherwise
 * CAPTURE (component.ts:491-494) claims it as author content. There is no
 * `<!--nisli:ch-->` provenance pair in the snapshot either — today's SSG has no
 * islands mode — so step 2 ("recover author content") has nothing to recover.
 */

interface FieldState {
  path: string;
  value: string;
  start: number | null;
  end: number | null;
  focused: boolean;
}

export interface HostFacts {
  localId: string | null;
  labelText: string | null;
  labelId: string | null;
  hintId: string | null;
  ariaLabelledBy: string | null;
  ariaDescribedBy: string | null;
  inputId: string | null;
  inputName: string | null;
  childrenHtml: string | null;
  rootCount: number;
  inputValue: string | null;
  selection: [number | null, number | null] | null;
  focused: boolean;
  signalValue: string | null;
  stamp: string | null;
}

const HOSTS = 'probe-island';

function hosts(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(HOSTS));
}

/** Stable-ish address for state carry: the ADR 0022 `data-slot` chain (brief step 4). */
function slotPath(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const parent = node.parentElement;
    parts.unshift(
      node.getAttribute('data-slot')
      ?? `*${parent ? Array.prototype.indexOf.call(parent.children, node) : 0}`,
    );
  }
  return parts.join('/');
}

/** Read the component's own signal through the expando seam, narrowing all the way. */
function signalValue(host: HTMLElement): string | null {
  if (!('__probe' in host)) return null;
  const seam: unknown = host.__probe;
  if (!seam || typeof seam !== 'object' || !('typed' in seam)) return null;
  const typed: unknown = seam.typed;
  if (!typed || typeof typed !== 'object' || !('value' in typed)) return null;
  return typeof typed.value === 'string' ? typed.value : null;
}

function facts(host: HTMLElement): HostFacts {
  const root = host.querySelector('[data-slot="root"]');
  const input = host.querySelector<HTMLInputElement>('input[data-slot="input"]');
  const label = host.querySelector('[data-slot="label"]');
  const hint = host.querySelector('[data-slot="hint"]');
  return {
    localId: root?.getAttribute('data-local-id') ?? null,
    labelText: label?.textContent ?? null,
    labelId: label?.getAttribute('id') ?? null,
    hintId: hint?.getAttribute('id') ?? null,
    ariaLabelledBy: input?.getAttribute('aria-labelledby') ?? null,
    ariaDescribedBy: input?.getAttribute('aria-describedby') ?? null,
    inputId: input?.getAttribute('id') ?? null,
    inputName: input?.getAttribute('name') ?? null,
    childrenHtml: host.querySelector('[data-slot="children"]')?.innerHTML.trim() ?? null,
    rootCount: host.querySelectorAll('[data-slot="root"]').length,
    inputValue: input ? input.value : null,
    selection: input ? [input.selectionStart, input.selectionEnd] : null,
    focused: input ? document.activeElement === input : false,
    signalValue: signalValue(host),
    stamp: host.getAttribute('data-nisli-adopted'),
  };
}

const snapshots = new Map<HTMLElement, FieldState[]>();
const server: HostFacts[] = [];
let blurs = 0;

/** P1 steps 1-2 + the forced pre-clear: snapshot interactive state, drop prior output. */
function prepare(): void {
  document.addEventListener('blur', () => { blurs += 1; }, true);
  for (const host of hosts()) {
    server.push(facts(host));
    const fields: FieldState[] = [];
    for (const el of host.querySelectorAll<HTMLInputElement>('input, textarea, select')) {
      fields.push({
        path: slotPath(el, host),
        value: el.value,
        start: el.selectionStart,
        end: el.selectionEnd,
        focused: document.activeElement === el,
      });
    }
    snapshots.set(host, fields);
    host.replaceChildren();
  }
}

/** P1 step 6: restore carried state onto the fresh nodes, then stamp the DOM fact. */
function finish(): void {
  for (const host of hosts()) {
    for (const field of snapshots.get(host) ?? []) {
      const fresh = Array.from(host.querySelectorAll<HTMLInputElement>('input, textarea, select'))
        .find(el => slotPath(el, host) === field.path);
      if (!fresh) continue;
      fresh.value = field.value;
      try {
        fresh.setSelectionRange(field.start, field.end);
      } catch { /* selection API throws on some input types — bounded best-effort */ }
      if (field.focused) fresh.focus();
    }
    host.removeAttribute('data-nisli-adopt');
    host.setAttribute('data-nisli-adopted', 'replace');
  }
}

declare global {
  interface Window {
    __adoptProbe: {
      prepare: () => void;
      finish: () => void;
      report: () => { server: HostFacts[]; client: HostFacts[]; blurs: number };
    };
  }
}

window.__adoptProbe = {
  prepare,
  finish,
  report: () => ({ server, client: hosts().map(facts), blurs }),
};
