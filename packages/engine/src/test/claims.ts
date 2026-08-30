/**
 * Claims — what a mounted screen must hold, checked over the tree with no
 * browser. A Claim is the engine saying, in data, that something a person
 * would otherwise catch by eye or by keyboard is wrong: a plan it could not
 * satisfy, a text that overflows its box without an ellipsis, a figure an
 * ellipsis would cut, a control with
 * no name, an id used twice, an unlabelled field, a dialog without its ARIA,
 * a menu holding something that is not a menu item, a block that failed, a
 * control a keyboard cannot reach. `prove()` runs every checker at every
 * width; an empty list is the proof.
 *
 * Every checker is pure over the DOM plus the estimating measurer: it reads
 * the inline styles the engine wrote and nothing else, so it runs in happy-dom
 * exactly as it would in a browser.
 */
import type { LayoutReport, ReportCode } from '../engine/report.js';
import { estimator, isTextual, estimateText, textStyleOf, ownText, type Estimator } from './estimate.js';

export type ClaimCode =
  | ReportCode          // a fit plan the engine could not satisfy
  | 'OVERFLOW_TEXT'     // a one-line text wider than its box, and no ellipsis to say so
  | 'FIGURE_TRUNCATED'  // a figure (tabular-nums) wider than its box: an ellipsis would hide digits
  | 'UNSETTLED'         // the screen was still changing when prove() stopped looking
  | 'NAME_MISSING'      // a button, link or input with no accessible name
  | 'ID_DUPLICATE'      // one id on two elements
  | 'LABEL_MISSING'     // an input inside a form with no label
  | 'DIALOG_ARIA'       // a dialog without aria-modal or a resolving aria-labelledby
  | 'MENU_ITEM_ROLE'    // a control inside a menu that is not a menuitem
  | 'BLOCK_ERROR'       // a block whose setup failed (data-nisli-error)
  | 'UNREACHABLE'       // an interactive element a keyboard cannot reach
  | 'SORT_UNREACHABLE'  // a sortable header with no control a keyboard can reach
  | 'POPUP_ARIA'        // an expanding control without a resolving aria-controls, or expanded over a hidden target
  | 'LIVE_TONE';        // a notice announced at the wrong urgency for its tone

export type Severity = 'error' | 'warning';

export interface Claim {
  readonly code: ClaimCode;
  /** The block (custom element tag) the claim is about, else the element's tag. */
  readonly block: string;
  readonly detail: string;
  readonly severity: Severity;
  /** The frame width the claim was found at; set by `prove()`. */
  readonly width?: number;
}

export interface Checker {
  readonly code: ClaimCode;
  check(root: HTMLElement, measure: Estimator): Claim[];
}

// ── Vocabulary ─────────────────────────────────────────────────────────

export const INTERACTIVE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
export const NAMED = 'a[href], button, input:not([type=hidden]), select, textarea';
/** A non-native element a keyboard can land on (a focusable `tr`, `div`): it must be named by its author. */
export const FOCUSABLE_NON_NATIVE = '[tabindex]:not([tabindex="-1"]):not(a):not(button):not(input):not(select):not(textarea)';
/** What a `label[for]` may point at. */
const LABELABLE = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'METER', 'OUTPUT', 'PROGRESS']);

/** The nearest block a node sits in, else its own tag. */
export const blockOf = (el: Element): string => {
  for (let n: Element | null = el; n; n = n.parentElement) if (n.tagName.includes('-') && n.tagName.toLowerCase().startsWith('nisli-')) return n.tagName.toLowerCase();
  return el.tagName.toLowerCase();
};

/** Hidden by the engine's own styling (inline display/visibility) or `hidden`, on it or an ancestor. */
export const isHidden = (el: Element): boolean => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const s = (n as HTMLElement).style;
    if (s && (s.display === 'none' || s.visibility === 'hidden')) return true;
    if (n.hasAttribute('hidden')) return true;
  }
  return false;
};

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** An accessible name, computed the way a browser does for the common cases: aria-labelledby, aria-label, a label, its content, a value, a title. */
export function accessibleName(el: Element): string {
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const named = by.split(/\s+/).map((id) => text(el.ownerDocument.getElementById(id))).filter(Boolean).join(' ');
    if (named) return named;
  }
  const label = el.getAttribute('aria-label')?.trim();
  if (label) return label;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
    const id = el.getAttribute('id');
    const forLabel = id ? text(el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`)) : '';
    if (forLabel) return forLabel;
    const wrapping = text(el.closest('label'));
    if (wrapping) return wrapping;
    const type = el.getAttribute('type');
    if (tag === 'INPUT' && (type === 'submit' || type === 'button' || type === 'reset')) {
      const value = el.getAttribute('value')?.trim();
      if (value) return value;
    }
  } else {
    const content = text(el) || [...el.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt')?.trim() ?? '').filter(Boolean).join(' ');
    if (content) return content;
  }
  return el.getAttribute('title')?.trim() ?? '';
}

/** Whether a modal dialog is open (visible) inside `root`. */
export const openModal = (root: HTMLElement): Element | null =>
  [...root.querySelectorAll('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]')].find((d) => !isHidden(d)) ?? null;

/** Whether a one-line text sits under an ellipsis: on itself or an ancestor that clips. */
const ellipsed = (el: HTMLElement): boolean => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (n.style.textOverflow === 'ellipsis' && n.style.overflow === 'hidden') return true;
  }
  return false;
};
/** Whether an element may not wrap: `white-space: nowrap` on it or an ancestor, closer than any `normal`. */
const nowrap = (el: HTMLElement): boolean => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const ws = n.style.whiteSpace;
    if (ws === 'nowrap' || ws === 'pre') return true;
    if (ws === 'normal' || ws === 'pre-wrap') return false;
  }
  return false;
};

// ── Checkers ───────────────────────────────────────────────────────────

/**
 * A one-line text wider than its box. Without an ellipsis it overflows or is
 * clipped with no decision made (`OVERFLOW_TEXT`); under an ellipsis a text
 * may truncate — that is the decision — but a figure may not: digits set in
 * `tabular-nums` (a table's money and date cells, a Stat's value, a meter, a
 * bar's value) that would end in `…` are a wrong number (`FIGURE_TRUNCATED`).
 *
 * The box a text has is its own pinned width (a table cell's decided width,
 * a Stat's grid cell), else its container's inner width. A flex row's
 * children share their container, so a button among siblings is compared
 * against the whole row: sharing a row is the fit reports' job (`FIT_ROW`),
 * not this claim's — read `OVERFLOW_TEXT` as "wider than anything it could
 * have been given", never as "does not fit beside its neighbours".
 */
export const overflowText: Checker = {
  code: 'OVERFLOW_TEXT',
  check: (root, measure) => {
    const claims: Claim[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      if (!isTextual(el) || isHidden(el) || !nowrap(el)) continue;
      const content = ownText(el);
      if (!content) continue;
      const clipped = ellipsed(el);
      const figure = clipped && !!textStyleOf(el).tabular && /[0-9]/.test(content);
      if (clipped && !figure) continue;
      const need = estimateText(el);
      const box = measure.box(el);
      if (box > 0 && need > box + 0.5) {
        const shown = content.length > 40 ? content.slice(0, 37) + '…' : content;
        claims.push(figure
          ? { code: 'FIGURE_TRUNCATED', block: blockOf(el), severity: 'error', detail: `<${el.tagName.toLowerCase()}> "${shown}" is a figure under an ellipsis: needs ${Math.round(need)}px in ${Math.round(box)}px` }
          : { code: 'OVERFLOW_TEXT', block: blockOf(el), severity: 'error', detail: `<${el.tagName.toLowerCase()}> "${shown}" needs ${Math.round(need)}px in ${Math.round(box)}px with no ellipsis` });
      }
    }
    return claims;
  },
};

/** A name the author gave: `aria-label`, or `aria-labelledby` that resolves to text. Content does not count. */
const authoredName = (el: Element): string => {
  const by = el.getAttribute('aria-labelledby');
  const named = by ? by.split(/\s+/).map((id) => text(el.ownerDocument.getElementById(id))).filter(Boolean).join(' ') : '';
  return named || (el.getAttribute('aria-label')?.trim() ?? '');
};

/**
 * Every button, link and input has an accessible name; every non-native
 * element a keyboard can land on (`tabindex`, not -1) has one from its
 * author — a `<tr>` full of cell text has content, not a name.
 */
export const accessibleNames: Checker = {
  code: 'NAME_MISSING',
  check: (root) => [
    ...[...root.querySelectorAll(NAMED)]
      .filter((el) => !isHidden(el) && !accessibleName(el))
      .map((el) => ({ code: 'NAME_MISSING' as const, block: blockOf(el), severity: 'error' as const, detail: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> has no accessible name` })),
    ...[...root.querySelectorAll(FOCUSABLE_NON_NATIVE)]
      .filter((el) => !isHidden(el) && !authoredName(el))
      .map((el) => ({ code: 'NAME_MISSING' as const, block: blockOf(el), severity: 'error' as const, detail: `focusable <${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> has no aria-label or resolving aria-labelledby` })),
  ],
};

/** No id is used twice: aria references, labels and anchors depend on it. */
export const uniqueIds: Checker = {
  code: 'ID_DUPLICATE',
  check: (root) => {
    const seen = new Map<string, Element[]>();
    for (const el of root.querySelectorAll('[id]')) { const id = el.id; if (id) (seen.get(id) ?? seen.set(id, []).get(id)!).push(el); }
    return [...seen].filter(([, els]) => els.length > 1)
      .map(([id, els]) => ({ code: 'ID_DUPLICATE' as const, block: blockOf(els[0]!), severity: 'error' as const, detail: `id "${id}" is on ${els.length} elements (${els.map((e) => e.tagName.toLowerCase()).join(', ')})` }));
  },
};

/** Every input inside a form block has a label: `label[for]`, a wrapping label, or aria-labelledby/aria-label. */
export const formLabels: Checker = {
  code: 'LABEL_MISSING',
  check: (root) => {
    const claims: Claim[] = [];
    const forms = [...root.querySelectorAll('nisli-form')];
    if (root.tagName === 'NISLI-FORM') forms.unshift(root);
    for (const form of forms) {
      for (const input of form.querySelectorAll('input:not([type=hidden]), select, textarea, [role=radiogroup], [role=group][aria-labelledby]')) {
        if (isHidden(input)) continue;
        const id = input.getAttribute('id');
        const labelled = !!(
          input.getAttribute('aria-labelledby')?.split(/\s+/).some((ref) => text(root.ownerDocument.getElementById(ref)))
          || input.getAttribute('aria-label')?.trim()
          || (id && text(form.querySelector(`label[for="${CSS.escape(id)}"]`)))
          || text(input.closest('label'))
        );
        if (!labelled) claims.push({ code: 'LABEL_MISSING', block: blockOf(input), severity: 'error', detail: `<${input.tagName.toLowerCase()}${id ? `#${id}` : ''}> in a form has no label` });
      }
      // A label that points at something a label cannot label (a radiogroup div) labels nothing.
      for (const label of form.querySelectorAll('label[for]')) {
        const target = root.ownerDocument.getElementById(label.getAttribute('for')!);
        if (!target || !LABELABLE.has(target.tagName)) {
          claims.push({ code: 'LABEL_MISSING', block: blockOf(label), severity: 'error', detail: `<label for="${label.getAttribute('for')}"> targets ${target ? `a <${target.tagName.toLowerCase()}>, which is not labelable` : 'no element'}` });
        }
      }
    }
    return claims;
  },
};

/** Every dialog is `aria-modal` and labelled by an element that exists and has text. */
export const dialogAria: Checker = {
  code: 'DIALOG_ARIA',
  check: (root) => {
    const claims: Claim[] = [];
    for (const d of root.querySelectorAll('[role=dialog], [role=alertdialog]')) {
      const problems: string[] = [];
      if (d.getAttribute('aria-modal') !== 'true') problems.push('no aria-modal="true"');
      const by = d.getAttribute('aria-labelledby');
      if (!by) problems.push('no aria-labelledby');
      else if (!text(root.ownerDocument.getElementById(by))) problems.push(`aria-labelledby="${by}" resolves to no text`);
      if (problems.length) claims.push({ code: 'DIALOG_ARIA', block: blockOf(d), severity: 'error', detail: `[role=${d.getAttribute('role')}]: ${problems.join('; ')}` });
    }
    return claims;
  },
};

/** Everything a keyboard can reach inside a menu is a menu item. */
export const menuItems: Checker = {
  code: 'MENU_ITEM_ROLE',
  check: (root) => {
    const claims: Claim[] = [];
    for (const menu of root.querySelectorAll('[role=menu], [role=menubar]')) {
      for (const el of menu.querySelectorAll(INTERACTIVE)) {
        const role = el.getAttribute('role') ?? '';
        if (!/^menuitem(checkbox|radio)?$/.test(role)) claims.push({ code: 'MENU_ITEM_ROLE', block: blockOf(el), severity: 'error', detail: `<${el.tagName.toLowerCase()}> "${text(el)}" inside [role=menu] has role "${role || 'none'}"` });
      }
    }
    return claims;
  },
};

/** No block failed: core stamps a host `data-nisli-error` when its setup or mount threw. */
export const blockErrors: Checker = {
  code: 'BLOCK_ERROR',
  check: (root) => {
    const els = [...root.querySelectorAll('[data-nisli-error]')];
    if (root.hasAttribute('data-nisli-error')) els.unshift(root);
    return els.map((el) => ({ code: 'BLOCK_ERROR' as const, block: el.tagName.toLowerCase(), severity: 'error' as const, detail: `<${el.tagName.toLowerCase()}> failed with ${el.getAttribute('data-nisli-error')}` }));
  },
};

/** Every visible interactive element is reachable: not inside `[inert]` — unless a modal is open above it, when only the modal's controls must be. */
export const reachable: Checker = {
  code: 'UNREACHABLE',
  check: (root) => {
    const modal = openModal(root);
    const claims: Claim[] = [];
    for (const el of root.querySelectorAll<HTMLElement>(INTERACTIVE)) {
      if (isHidden(el) || el.hasAttribute('disabled')) continue;
      const inert = !!el.closest('[inert]');
      if (modal) {
        if (modal.contains(el) && inert) claims.push({ code: 'UNREACHABLE', block: blockOf(el), severity: 'error', detail: `<${el.tagName.toLowerCase()}> "${accessibleName(el)}" inside the open dialog is inert` });
      } else if (inert) {
        claims.push({ code: 'UNREACHABLE', block: blockOf(el), severity: 'error', detail: `<${el.tagName.toLowerCase()}> "${accessibleName(el)}" is inert with no modal open` });
      }
    }
    return claims;
  },
};

/** Every sortable header — `th[aria-sort]`, or a `th` the engine styled `cursor: pointer` — holds a control a keyboard can reach. */
export const sortReachable: Checker = {
  code: 'SORT_UNREACHABLE',
  check: (root) => [...root.querySelectorAll<HTMLElement>('th')]
    .filter((th) => !isHidden(th) && (th.hasAttribute('aria-sort') || th.style.cursor === 'pointer') && !th.querySelector(INTERACTIVE))
    .map((th) => ({ code: 'SORT_UNREACHABLE' as const, block: blockOf(th), severity: 'error' as const, detail: `<th> "${text(th)}" is sortable but holds no focusable control` })),
};

/**
 * Every visible control that says it expands (`aria-expanded`) or opens a
 * popup (`aria-haspopup`) controls an element that exists (`aria-controls`),
 * and one that says it is expanded controls an element that is shown.
 */
export const popupAria: Checker = {
  code: 'POPUP_ARIA',
  check: (root) => {
    const claims: Claim[] = [];
    for (const el of root.querySelectorAll('[aria-expanded], [aria-haspopup]')) {
      if (isHidden(el)) continue;
      const controls = el.getAttribute('aria-controls');
      const target = controls ? root.ownerDocument.getElementById(controls) : null;
      const name = `<${el.tagName.toLowerCase()}> "${accessibleName(el)}"`;
      if (!controls) claims.push({ code: 'POPUP_ARIA', block: blockOf(el), severity: 'error', detail: `${name} has ${el.hasAttribute('aria-expanded') ? 'aria-expanded' : 'aria-haspopup'} but no aria-controls` });
      else if (!target) claims.push({ code: 'POPUP_ARIA', block: blockOf(el), severity: 'error', detail: `${name} aria-controls="${controls}" resolves to no element` });
      else if (el.getAttribute('aria-expanded') === 'true' && isHidden(target)) claims.push({ code: 'POPUP_ARIA', block: blockOf(el), severity: 'error', detail: `${name} says expanded but #${controls} is hidden` });
    }
    return claims;
  },
};

/** Every notice is announced at its tone's urgency: `negative` in an assertive `alert`, every other tone in a polite `status`. */
export const liveTone: Checker = {
  code: 'LIVE_TONE',
  check: (root) => {
    const claims: Claim[] = [];
    for (const n of root.querySelectorAll('[data-nisli-tone]')) {
      const tone = n.getAttribute('data-nisli-tone');
      const assertive = !!n.closest('[aria-live="assertive"], [role="alert"]');
      const polite = !!n.closest('[aria-live="polite"], [role="status"]');
      // A negative notice must sit in an assertive container; any other tone in a polite one. No container at all is as wrong as the wrong one.
      if (tone === 'negative' ? !assertive : !polite) {
        const how = tone === 'negative' ? (polite ? 'announced politely' : 'not announced') : assertive ? 'announced assertively' : 'not announced';
        claims.push({ code: 'LIVE_TONE', block: blockOf(n), severity: 'error', detail: `a ${tone} notice "${text(n)}" is ${how}` });
      }
    }
    return claims;
  },
};

/** Every checker, in the order they run. */
export const checkers: readonly Checker[] = [overflowText, accessibleNames, uniqueIds, formLabels, dialogAria, menuItems, blockErrors, reachable, sortReachable, popupAria, liveTone];

/** A layout report as a claim: a fit plan the engine could not satisfy. */
export const reportClaim = (r: LayoutReport): Claim => ({
  code: r.code,
  block: r.block,
  severity: 'error',
  detail: `${r.detail} (${Math.round(r.deficit)}px short at ${Math.round(r.width)}px)`,
});

/** Run every checker over a mounted tree. `measure` defaults to the estimator at `root`'s frame (the document width). */
export function claimsOf(root: HTMLElement, measure: Estimator = estimator(root.ownerDocument.documentElement.clientWidth || 1024)): Claim[] {
  return checkers.flatMap((c) => c.check(root, measure));
}
