#!/usr/bin/env node
/**
 * geometry-proof.mjs — the real-layout oracle.
 *
 * The unit tests prove the domain makes the right DECISION given geometry.
 * Only a browser can say whether the geometry it is handed is the truth. This
 * script drives the harness through the context matrix and, after every
 * combination, measures the page itself.
 *
 * It starts nothing. Point it at a running dev server:
 *
 *   pnpm --filter @nisli/experiment-c11-appearance dev     # in another shell
 *   node proof/geometry-proof.mjs
 *   node proof/geometry-proof.mjs --url http://127.0.0.1:5199
 *   node proof/geometry-proof.mjs --filter inbox/dense
 *   node proof/geometry-proof.mjs --self-test
 *
 * Eight assertions per combination:
 *
 *   declared  every appearance declaration sits on an element that owns a box
 *   fit       every [data-fit] container reports settled
 *   afford    a collapsed group's trigger is painted and reachable
 *   crush     nothing inside the canvas paints outside its own box (F8)
 *   overlap   no two rendered siblings' boxes intersect (F8, the visible half)
 *   document  the document does not exceed the window
 *   check     the derived checker reports no failures
 *   overlay   all seven of the above, plus four claims only an open panel can
 *             answer, measured again with each overflow menu OPEN
 *
 * `overlay` is the newest and it exists because the other seven were blind. An
 * overlay is rendered only while it is open; every rule and every assertion
 * here traverses what is rendered; and until this pass existed nothing opened
 * one during a run. So menus, their items and every label in them had never
 * been measured by anything — this matrix was reporting a clean document with a
 * closed door in it. F4 established that rendered-ness is a precondition of
 * measurement; this is the corollary nobody drew, that something has to make
 * the transient thing rendered or the precondition silently excludes it.
 *
 * `--self-test` is the guard on the guard. This repository has three recorded
 * false-PASS oracles; a proof that cannot fail is decoration. The self-test
 * breaks each assertion path in turn and requires the proof to notice. The
 * `overlay` row additionally requires the CONTRAST: the defect it injects is
 * reachable only inside an open panel, so the row is only evidence if the seven
 * closed-state assertions stay silent on the same document.
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, 'shots');

const PAGES = ['inbox', 'settings', 'data', 'marketing'];
const DENSITIES = ['comfortable', 'compact', 'dense'];
const INPUTS = ['pointer', 'touch'];
const THEMES = ['light', 'dark'];
const WIDTHS = [1080, 720, 480, 360, 320];

/** The seven assertions about the document as it sits. */
const CLOSED_CHECKS = ['declared', 'fit', 'afford', 'crush', 'overlap', 'document', 'check'];

/** Plus the same seven, and four more, measured with each overlay open. */
const CHECKS = [...CLOSED_CHECKS, 'overlay'];

/* ══════════════════════════════════════════════════════════════════════════
   Arguments
   ══════════════════════════════════════════════════════════════════════════ */

const USAGE =
  'usage: geometry-proof.mjs [--url URL] [--filter SUBSTRING] [--viewport WxH] [--no-shots] [--no-overlays] [--headed] [--self-test]';

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:5199',
    filter: '',
    viewport: { width: 1280, height: 900 },
    shots: true,
    overlays: true,
    selfTest: false,
    headed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const split = arg.indexOf('=');
    const flag = split < 0 ? arg : arg.slice(0, split);
    const inline = split < 0 ? undefined : arg.slice(split + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (argv[i] === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
      return argv[i];
    };
    switch (flag) {
      case '--url':
        options.url = value();
        break;
      case '--filter':
        options.filter = value();
        break;
      case '--viewport': {
        const [width, height] = value().split('x');
        options.viewport = { width: Number(width), height: Number(height ?? 900) };
        break;
      }
      case '--no-shots':
        options.shots = false;
        break;
      // Here to MEASURE the overlay pass, not to escape it. The cost of opening
      // every menu in every context is a number a reader is entitled to, and
      // the only way to produce it is to run the matrix both ways. A run with
      // the pass off says so in its verdict line.
      case '--no-overlays':
        options.overlays = false;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown flag ${flag}\n${USAGE}`);
    }
  }
  return options;
}

/* ══════════════════════════════════════════════════════════════════════════
   The in-page audit — the only code here that sees real geometry
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `options.overlays` decides whether the closed document is the whole document.
 *
 * The seven closed-state assertions live in `measure()` rather than inline, and
 * that is the load-bearing part of this file's shape: the overlay pass calls the
 * SAME function, so "what was measured with the menu open" cannot drift into a
 * weaker oracle than "what was measured with it closed". A second, hand-written
 * open-state suite is exactly how a checker acquires two definitions of clean.
 */
function auditInPage(options) {
  const api = window.__c11;
  if (typeof api?.check !== 'function') return { fatal: 'window.__c11.check is missing' };
  if (typeof api?.sweepOverlays !== 'function') {
    return { fatal: 'window.__c11.sweepOverlays is missing: this harness cannot open an overlay' };
  }
  const canvas = api.canvas ?? document.getElementById('canvas');
  if (!canvas) return { fatal: 'no canvas element: the harness did not mount' };

  const DECLARATIONS = ['data-appearance', 'data-text', 'data-layout', 'data-collapse', 'data-grow'];

  const describe = (el) => {
    if (!el) return 'nothing';
    let out = el.tagName.toLowerCase();
    if (el.id) out += `#${el.id}`;
    for (const name of ['data-appearance', 'data-text', 'data-layout', 'data-role', 'data-fit']) {
      const value = el.getAttribute?.(name);
      if (value !== null && value !== undefined) out += `[${name}="${value}"]`;
    }
    const label = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
    return label ? `${out} "${label}"` : out;
  };

  // Rendered-ness is a precondition of every measurement (F4). It is also what
  // makes a layout-transparent component host invisible here: nisli renders a
  // component's template inside its host element and the theme sets those
  // hosts to `display: contents`, so the host owns no box at all. The thing
  // that can be crushed or overlapped is the inner element — which is also the
  // element that carries every declaration. The `declared` assertion below
  // proves that last clause rather than assuming it.
  const boxed = (el) => {
    if (!el || el.getClientRects().length === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  /**
   * The seven assertions, over the document exactly as it stands when called.
   * Called once with every overlay closed, and once per overlay while that one
   * is open.
   */
  function measure() {
    /* ── declared ──────────────────────────────────────────────────────── */
    // A declaration on a boxless element is the F8 hole reopened one level up:
    // the theme's no-crush rules key off `[data-layout] > [data-truncate]` and
    // `> [data-grow]`, which can only match the element the flex algorithm
    // actually sizes. Declaration and box must be the same element.
    const declared = [];
    for (const el of canvas.querySelectorAll('*')) {
      if (getComputedStyle(el).display !== 'contents') continue;
      const carried = DECLARATIONS.filter((name) => el.hasAttribute(name));
      if (carried.length === 0) continue;
      declared.push({
        subject: describe(el),
        detail: `carries ${carried.join(', ')} while being display: contents — it owns no box, so no theme rule keyed to that declaration can ever size it`,
      });
    }

    /* ── fit ───────────────────────────────────────────────────────────── */
    const fit = [];
    for (const el of canvas.querySelectorAll('[data-fit]')) {
      const state = el.getAttribute('data-fit');
      if (state !== 'settled') {
        fit.push({
          subject: describe(el),
          detail: `data-fit="${state}" at clientWidth ${el.clientWidth}, scrollWidth ${el.scrollWidth}`,
        });
      }
    }

    /* ── afford ────────────────────────────────────────────────────────── */
    // A solver must measure the world it CREATES, including its own affordances.
    // The early-stop defect was exactly this: the overflow trigger was revealed
    // after the loop, so every pass measured a geometry with no trigger in it,
    // the loop stopped the instant the container fit, and the trigger then ate
    // the 2-3px that made it fit. Both directions are asserted, because both are
    // the same mistake: a collapsed group with no painted trigger means the
    // actions are unreachable (F6), and a painted trigger with nothing collapsed
    // means inline space spent on an affordance for nothing.
    const afford = [];
    for (const container of canvas.querySelectorAll('[data-fit]')) {
      // Own candidates only: a nested fit container answers for its own.
      const mine = (el) => el.closest('[data-fit]') === container;
      const collapsed = [...container.querySelectorAll('[data-collapsed]')].filter(mine).length;
      const trigger = [...container.querySelectorAll('[data-overflow]')].find(mine) ?? null;
      const shown = trigger !== null && trigger.hasAttribute('data-shown');

      if (collapsed > 0 && trigger === null) {
        afford.push({
          subject: describe(container),
          detail: `${collapsed} group(s) moved into a menu but the container has no [data-overflow] trigger — those actions are unreachable`,
        });
      } else if (collapsed > 0 && !shown) {
        afford.push({
          subject: describe(container),
          detail: `${collapsed} group(s) moved into a menu but the trigger is not marked data-shown`,
        });
      } else if (collapsed > 0 && !boxed(trigger)) {
        afford.push({
          subject: describe(container),
          detail: 'the trigger is marked data-shown but owns no box, so it is neither in the geometry the solver measured nor clickable',
        });
      } else if (collapsed === 0 && shown && boxed(trigger)) {
        afford.push({
          subject: describe(container),
          detail: 'the overflow trigger is painted while nothing is collapsed — inline space spent on an affordance that leads nowhere',
        });
      }
    }

    /* ── crush ─────────────────────────────────────────────────────────── */
    // This mirrors N660, not domMetrics.crushed(). The two differ on one point:
    // the solver exempts `overflow: hidden`/`clip` because a clipped box is not
    // its problem, while the checker still fails it because clipped content is
    // unreadable content. The assertion being made here is "nothing on screen is
    // unreadable", so the checker's spelling is the right one. Shared with both:
    // declared truncation, a text field (an input scrolls its own value), and
    // real scrollers. Boxless nodes need no rule; they report 0/0.
    //
    // One more exemption, matching the ruling on N660/N670: a container that has
    // already stamped `data-fit="unsatisfiable"` has DECLARED its failure, and
    // the `fit` assertion above reports it with the shortfall and the
    // degradations spent. Reporting the same pixels again as a crush adds no
    // fact and trains people to mute the code. Exactly that node is exempt —
    // its descendants are not, because a crushed CHILD inside an unsatisfiable
    // row is still F8 and is exactly what nobody would otherwise notice.
    //
    // There USED to be a third exemption here, `[data-overflow-menu]`, and
    // deleting it is half of what the overlay pass is for. It never suppressed
    // anything: the panel is rendered only while the menu is open and nothing
    // opened one, so the line was a skip for a subtree that was never in the
    // document when this ran. It would have started suppressing the moment the
    // pass below opened the door — an exemption that becomes load-bearing at the
    // exact instant the thing it exempts becomes measurable is a hole, not a
    // ruling. If the panel crushes, that is a finding.
    const crush = [];
    for (const el of canvas.querySelectorAll('*')) {
      if (el.closest('[data-escaped]')) continue;
      if (el.hasAttribute('data-truncate')) continue;
      if (el.getAttribute('data-appearance') === 'field') continue;
      if (el.getAttribute('data-fit') === 'unsatisfiable') continue;
      if (el.clientWidth === 0 && el.scrollWidth === 0) continue;
      if (!boxed(el)) continue;
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        crush.push({
          subject: describe(el),
          detail: `clientWidth ${el.clientWidth} but scrollWidth ${el.scrollWidth} — content paints ${el.scrollWidth - el.clientWidth}px outside its own box`,
        });
      }
    }

    /* ── overlap ───────────────────────────────────────────────────────── */
    // Siblings in the LAYOUT sense. A boxless wrapper is not a flex item, so it
    // is flattened away and its children take its place: two buttons living
    // inside two different component hosts are still compared to each other.
    // Without this the assertion would be vacuous under layout-transparent
    // hosts, which is exactly the false-PASS shape this proof exists to avoid.
    const laidOutChildren = (el) => {
      const out = [];
      for (const child of el.children) {
        if (!boxed(child)) {
          out.push(...laidOutChildren(child));
          continue;
        }
        const position = getComputedStyle(child).position;
        // An overlay is supposed to paint over its siblings; that is what an
        // overflow menu IS. Only in-flow boxes promise to keep to themselves.
        if (position !== 'static' && position !== 'relative') continue;
        out.push(child);
      }
      return out;
    };

    // The panel is skipped as a CHILD by the position test above, which is the
    // ruling that an overlay may paint over its siblings. It is not skipped as a
    // CONTAINER: its own items are in flow with each other and have no such
    // licence. The `[data-overflow-menu]` exemption that used to be here made
    // the panel's interior unexaminable and, like the crush one, only ever
    // covered a subtree no run had in the document.
    const overlap = [];
    const seen = new Set();
    for (const container of [canvas, ...canvas.querySelectorAll('*')]) {
      if (container.closest('[data-escaped]')) continue;
      const kids = laidOutChildren(container);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const inline = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const block = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (inline <= 1 || block <= 1) continue;
          const key = `${describe(kids[i])}|${describe(kids[j])}|${Math.round(a.left)}|${Math.round(b.left)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          overlap.push({
            subject: `${describe(kids[i])} × ${describe(kids[j])}`,
            detail:
              `inline overlap ${inline.toFixed(1)}px, block overlap ${block.toFixed(1)}px — ` +
              `[${a.left.toFixed(1)} … ${a.right.toFixed(1)}] against [${b.left.toFixed(1)} … ${b.right.toFixed(1)}]`,
          });
        }
      }
    }

    /* ── document ──────────────────────────────────────────────────────── */
    const documentIssues = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1) {
      documentIssues.push({
        subject: 'document',
        detail: `scrollWidth ${root.scrollWidth} exceeds innerWidth ${window.innerWidth}`,
      });
    }
    if (canvas.scrollWidth > canvas.clientWidth + 1) {
      documentIssues.push({
        subject: 'canvas',
        detail: `scrollWidth ${canvas.scrollWidth} exceeds its own ${canvas.clientWidth}px box`,
      });
    }

    /* ── check ─────────────────────────────────────────────────────────── */
    // Plain `check()`, with no overlay option: this call judges the document as
    // it stands, and the pass below is what puts an open panel into it. Asking
    // the harness to sweep from in here would nest one sweep inside another.
    const findings = api.check().map((f) => ({
      code: f.code,
      severity: f.severity,
      subject: f.subject,
      detail: f.detail,
    }));

    return {
      declared,
      afford,
      fit,
      crush,
      overlap,
      document: documentIssues,
      findings,
      escapes: canvas.querySelectorAll('[data-escaped]').length,
    };
  }

  const closed = measure();
  const triggers = canvas.querySelectorAll('[data-overflow][data-shown]').length;
  if (options?.overlays !== true) {
    return { ...closed, overlays: [], triggers, opened: 0, swept: false };
  }

  /** Scripts that wrap between characters, where `lines > words` proves nothing.
   *  Copied from N690 on purpose: this pass makes the same claim, so it inherits
   *  the same declared limit rather than inventing a second, quieter one. */
  const UNSPACED_SCRIPT =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

  /**
   * The four claims only an open panel can answer. Everything else about the
   * open state is `measure()` again, which is the point.
   */
  function inspectPanel(trigger, panel) {
    const issues = [];

    if (!boxed(panel)) {
      issues.push({
        subject: describe(panel),
        detail: `${describe(trigger)} was invoked and named this panel, but the panel owns no box — the collapsed actions are still unreachable`,
      });
      // Nothing below is measurable on a boxless panel, and guessing at it is
      // how F4 produced ten false failures.
      return issues;
    }

    // F6 extended from PAINTED to OPERABLE. A menu the pointer can see and the
    // keyboard cannot enter is a degradation that deleted half its promise.
    if (!panel.contains(document.activeElement)) {
      issues.push({
        subject: describe(panel),
        detail: `the panel is open but focus is on ${describe(document.activeElement)} — a keyboard user has nowhere to arrive`,
      });
    }

    // ONE claim, not two: "does this open panel offer anything a finger or a
    // key can reach". A zero-item panel and a panel whose every item is
    // unpainted are the same defect to a user — the actions the solver moved
    // here are gone — and splitting them produced an arm that no fixture could
    // falsify, which is decoration by this repository's own standard. The count
    // is in the message so the two causes stay distinguishable to whoever fixes
    // it. A PARTIAL loss keeps its own report, because half a menu is a
    // different fix from no menu.
    const items = [...panel.querySelectorAll('[role="menuitem"]')];
    const pressable = items.filter(boxed);
    if (pressable.length === 0) {
      issues.push({
        subject: describe(panel),
        detail: `this open panel holds ${items.length} menuitem(s) and none of them owns a box — the actions the solver moved into the menu cannot be pressed`,
      });
    } else {
      for (const item of items) {
        if (boxed(item)) continue;
        issues.push({
          subject: describe(item),
          detail: 'this menuitem is inside an open panel beside items that do paint, and owns no box, so it alone cannot be pressed',
        });
      }
    }

    // LINE BOXES, not a height divided by a line height. Two independent
    // reasons, and the second is the one that makes this assertion necessary
    // rather than duplicative:
    //
    //  - a menu item's block size is floored by `--min-target`, so every item
    //    is the same height whether its label wrapped or not. Dividing that
    //    height by a line height reports the same fractional line count for a
    //    clean label and a shredded one, which is N690's recorded mistake made
    //    a fourth time by someone who had just read about it.
    //  - N690's selector is `[data-text]`. A menu item is
    //    `[data-appearance="action"]`, so NOTHING in the rule set measures line
    //    breaking on an action label — open or closed. This is the one claim in
    //    the overlay pass that no existing code makes.
    //
    // The inference is N690's and unchanged: n words cannot occupy more than n
    // line boxes unless a word was broken inside itself.
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = (node.nodeValue ?? '').trim();
      if (text.length === 0) continue;
      if (UNSPACED_SCRIPT.test(text)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = range.getClientRects().length;
      const words = text.split(/\s+/).length;
      if (lines === 0 || lines <= words) continue;
      issues.push({
        subject: `${describe(node.parentElement)} "${text.slice(0, 24)}"`,
        detail: `${words} word(s) across ${lines} line box(es) inside an open overlay, so a word was broken inside itself to fit a ${Math.round(panel.clientWidth)}px panel`,
      });
    }

    return issues;
  }

  const overlays = [];
  const opened = api.sweepOverlays(canvas, ({ trigger, panel }) => {
    if (panel === null) {
      overlays.push({
        trigger: describe(trigger),
        panel: null,
        measures: measure(),
        extra: [
          {
            subject: describe(trigger),
            detail: 'this trigger is painted, was invoked, and named no panel through aria-controls — nothing inside the overlay could be measured',
          },
        ],
      });
      return;
    }
    overlays.push({
      trigger: describe(trigger),
      panel: describe(panel),
      extra: inspectPanel(trigger, panel),
      // Last, so the panel-specific reads above happen before anything else has
      // had a chance to touch the geometry.
      measures: measure(),
    });
  });

  return { ...closed, overlays, triggers, opened, swept: true };
}

/* ══════════════════════════════════════════════════════════════════════════
   Classification — which findings are allowed, by code and by structure
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The escape hatch reporting itself is the escape hatch working (F7), so N601
 * warnings are expected. They are allowed by CODE, and tied to STRUCTURE: one
 * warning per `[data-escaped]` subtree actually present. A bare count would
 * wave a second, accidental escape hatch straight through.
 */
function classifyFindings(audit) {
  const offenders = [];
  let escapeWarnings = 0;
  for (const finding of audit.findings) {
    if (finding.severity === 'fail') {
      offenders.push({ subject: `${finding.code} ${finding.subject}`, detail: finding.detail });
      continue;
    }
    if (finding.severity !== 'warn') continue;
    if (finding.code === 'N601') {
      escapeWarnings += 1;
      continue;
    }
    offenders.push({
      subject: `${finding.code} ${finding.subject}`,
      detail: `unexpected warning — only the escape hatch (N601) is allowlisted: ${finding.detail}`,
    });
  }
  if (escapeWarnings !== audit.escapes) {
    offenders.push({
      subject: 'N601 allowlist',
      detail: `${escapeWarnings} escape warnings for ${audit.escapes} [data-escaped] subtrees — the allowlist is keyed to structure, not to a count`,
    });
  }
  return offenders;
}

/**
 * The seven closed-state assertions, plus `overlay`: the same seven measured
 * again with each menu open, MINUS whatever the closed document already said,
 * plus the four claims only an open panel can answer.
 *
 * The subtraction is attribution, not suppression. Every open pass re-runs the
 * whole suite, so a defect that exists with the door shut would otherwise be
 * repeated once per overlay in a column that is supposed to mean "this is what
 * opening the menu costs you". Identity is assertion + subject + detail, and
 * `detail` is in the key because it carries the magnitude — the same subject
 * reporting a larger overhang with the panel open is a different fact and
 * survives into the overlay column, which is exactly the case that matters.
 */
function classify(audit) {
  const closed = {
    declared: audit.declared,
    afford: audit.afford,
    fit: audit.fit,
    crush: audit.crush,
    overlap: audit.overlap,
    document: audit.document,
    check: classifyFindings(audit),
  };

  const already = new Set();
  for (const name of CLOSED_CHECKS) {
    for (const offender of closed[name]) already.add(`${name}\u0000${offender.subject}\u0000${offender.detail}`);
  }

  const overlay = [];
  for (const state of audit.overlays ?? []) {
    for (const offender of state.extra) {
      overlay.push({
        subject: `open ⟨${state.trigger}⟩ · panel · ${offender.subject}`,
        detail: offender.detail,
      });
    }
    const open = { ...state.measures, check: classifyFindings(state.measures) };
    for (const name of CLOSED_CHECKS) {
      for (const offender of open[name]) {
        if (already.has(`${name}\u0000${offender.subject}\u0000${offender.detail}`)) continue;
        overlay.push({
          subject: `open ⟨${state.trigger}⟩ · ${name} · ${offender.subject}`,
          detail: offender.detail,
        });
      }
    }
  }

  return { ...closed, overlay };
}

/**
 * `incomplete` is an unanswered question, not a pass, so the open state's
 * questions count too — under the same identity rule the offender diff uses, or
 * every closed-state admission would be multiplied by the number of menus on
 * the page.
 */
function countIncomplete(audit) {
  const already = new Set();
  let total = 0;
  for (const finding of audit.findings) {
    if (finding.severity !== 'incomplete') continue;
    already.add(`${finding.code}\u0000${finding.subject}\u0000${finding.detail}`);
    total += 1;
  }
  for (const state of audit.overlays ?? []) {
    for (const finding of state.measures.findings) {
      if (finding.severity !== 'incomplete') continue;
      const key = `${finding.code}\u0000${finding.subject}\u0000${finding.detail}`;
      if (already.has(key)) continue;
      already.add(key);
      total += 1;
    }
  }
  return total;
}

/* ══════════════════════════════════════════════════════════════════════════
   Output
   ══════════════════════════════════════════════════════════════════════════ */

function printRow(cells, widths) {
  console.log(
    cells
      .map((cell, i) => String(cell).padEnd(widths[i]))
      .join('  ')
      .trimEnd(),
  );
}

/** `opened` is not an assertion; it is the count that makes `overlay` non-vacuous. */
const HEADERS = ['context', ...CHECKS, 'opened', 'incompl', 'result'];
const COLUMN_WIDTHS = [34, 8, 4, 6, 5, 7, 8, 5, 7, 6, 7, 6];

/* ══════════════════════════════════════════════════════════════════════════
   The matrix run
   ══════════════════════════════════════════════════════════════════════════ */

function buildMatrix(filter) {
  const combos = [];
  for (const page of PAGES) {
    for (const density of DENSITIES) {
      for (const input of INPUTS) {
        for (const theme of THEMES) {
          for (const width of WIDTHS) {
            const label = `${page}/${density}/${input}/${theme}/${width}`;
            if (filter && !label.includes(filter)) continue;
            combos.push({ label, context: { page, density, input, theme, width } });
          }
        }
      }
    }
  }
  return combos;
}

async function applyContext(page, context) {
  await page.evaluate(async (ctx) => {
    window.__c11.setContext(ctx);
    await window.__c11.settled();
  }, context);
}

const LOST_CONTEXT = /Execution context was destroyed|frame was detached|Cannot find context|Target closed/i;

/**
 * The dev server reloads the page whenever anything under `src/` is saved, and
 * a reload lands mid-combination as a destroyed execution context. That is the
 * tool losing its grip on the page, not a defect in the page — reporting it as
 * a failure would be a false FAIL, and crashing on it makes the proof unusable
 * while anyone is editing. Re-attach and take the measurement again; the
 * reload count is reported so a suspiciously quiet run cannot hide behind one.
 */
async function resilient(page, state, action) {
  try {
    return await action();
  } catch (error) {
    if (!LOST_CONTEXT.test(String(error))) throw error;
    state.reloads += 1;
    await page.waitForFunction(() => typeof window.__c11?.settled === 'function', undefined, {
      timeout: 15_000,
    });
    await page.evaluate(() => window.__c11.settled());
    return await action();
  }
}

async function openHarness(options) {
  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: options.viewport });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(options.url, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__c11?.settled === 'function', undefined, {
    timeout: 15_000,
  });
  await page.evaluate(() => window.__c11.settled());
  return { browser, page, errors };
}

/**
 * F6, in real Chromium. "Overflow menus are stubs. No popover, no keyboard, no
 * ARIA — the collapsed actions become unreachable" was the recorded blocker.
 * A collapsed action that cannot be reached is not a degradation, it is a
 * deletion, so the fit solver's whole licence to collapse rests on this.
 *
 * The menu closes on `resize`, so this runs once, after the matrix, with no
 * viewport change in between.
 */
async function proveAffordance(page) {
  const steps = [];
  await applyContext(page, {
    page: 'inbox',
    density: 'comfortable',
    input: 'pointer',
    theme: 'light',
    width: 320,
  });

  const trigger = page.locator('[data-overflow][data-shown]').first();
  if ((await trigger.count()) === 0) {
    steps.push({
      ok: false,
      name: 'trigger painted',
      detail: 'nothing collapsed into a menu at 320px, so either the solver did not collapse or the trigger is not revealed',
    });
    return steps;
  }
  steps.push({ ok: true, name: 'trigger painted', detail: 'a collapsed group revealed its trigger at 320px' });

  const closed = await page.evaluate(() => {
    const el = document.querySelector('[data-overflow][data-shown]');
    return {
      haspopup: el?.getAttribute('aria-haspopup'),
      expanded: el?.getAttribute('aria-expanded'),
      panels: document.querySelectorAll('[role="menu"]').length,
    };
  });
  steps.push({
    ok: closed.haspopup === 'menu' && closed.expanded === 'false' && closed.panels === 0,
    name: 'closed state',
    detail: `aria-haspopup="${closed.haspopup}", aria-expanded="${closed.expanded}", ${closed.panels} panels in the document`,
  });

  await trigger.click();
  const opened = await page.evaluate(() => {
    const el = document.querySelector('[data-overflow][data-shown]');
    const panel = document.querySelector('[role="menu"]');
    const items = panel ? [...panel.querySelectorAll('[role="menuitem"]')] : [];
    return {
      expanded: el?.getAttribute('aria-expanded'),
      controls: el?.getAttribute('aria-controls'),
      panelId: panel?.id ?? null,
      items: items.map((item) => (item.textContent ?? '').trim()),
      focused: document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName,
    };
  });
  steps.push({
    ok: opened.expanded === 'true' && opened.panelId !== null && opened.controls === opened.panelId,
    name: 'opened state',
    detail: `aria-expanded="${opened.expanded}", aria-controls="${opened.controls}" naming panel "${opened.panelId}"`,
  });
  steps.push({
    ok: opened.items.length > 0,
    name: 'actions reachable',
    detail: opened.items.length > 0 ? `${opened.items.length} menuitem(s): ${opened.items.join(', ')}` : 'the panel is empty — the collapsed actions are still unreachable',
  });
  steps.push({
    ok: opened.focused === 'menuitem',
    name: 'focus moved',
    detail: `focus is on ${opened.focused}`,
  });

  await page.keyboard.press('Escape');
  const dismissed = await page.evaluate(() => ({
    panels: document.querySelectorAll('[role="menu"]').length,
    expanded: document.querySelector('[data-overflow][data-shown]')?.getAttribute('aria-expanded'),
    focusedOverflow: document.activeElement?.hasAttribute('data-overflow') ?? false,
  }));
  steps.push({
    ok: dismissed.panels === 0 && dismissed.expanded === 'false' && dismissed.focusedOverflow,
    name: 'escape returns focus',
    detail: `${dismissed.panels} panels, aria-expanded="${dismissed.expanded}", focus back on the trigger: ${dismissed.focusedOverflow}`,
  });

  return steps;
}

async function runMatrix(options) {
  const combos = buildMatrix(options.filter);
  if (combos.length === 0) {
    console.error(`no combination matches --filter ${options.filter}`);
    return 1;
  }

  if (options.shots) {
    // Clear the directory only on a FULL run, and this is a defect that was
    // found the expensive way: `proof/shots/` holds 240 tracked files, nothing
    // gitignores it whatever the README says, and wiping it before writing the
    // handful of cells a `--filter` matched deleted 230 of them. A tool that
    // silently destroys the artefact it exists to produce is the same failure
    // as an oracle that reports success while deleting functionality, which is
    // F6. A filtered run now overwrites what it measured and leaves the rest
    // alone, so the directory is only ever wholly rewritten by a run that
    // wholly re-measured it.
    if (options.filter) await mkdir(SHOTS, { recursive: true });
    else {
      await rm(SHOTS, { recursive: true, force: true });
      await mkdir(SHOTS, { recursive: true });
    }
  }

  const { browser, page, errors } = await openHarness(options);
  const failures = [];
  const state = { reloads: 0 };
  let incompleteTotal = 0;
  let openedTotal = 0;
  let triggersTotal = 0;
  const startedAt = Date.now();

  console.log(`c11 geometry proof — ${combos.length} combinations against ${options.url}`);
  console.log(
    `browser viewport ${options.viewport.width}x${options.viewport.height}; the harness width is driven through setContext`,
  );
  console.log(
    options.overlays
      ? 'overlay pass ON: every revealed overflow trigger is opened, measured and closed in every cell\n'
      : 'overlay pass OFF (--no-overlays): overlay content is NOT measured in this run\n',
  );
  printRow(HEADERS, COLUMN_WIDTHS);
  printRow(
    HEADERS.map((header) => '─'.repeat(header.length)),
    COLUMN_WIDTHS,
  );

  try {
    for (const combo of combos) {
      const audit = await resilient(page, state, async () => {
        await applyContext(page, combo.context);
        return page.evaluate(auditInPage, { overlays: options.overlays });
      });
      if (audit.fatal) {
        failures.push({
          label: combo.label,
          check: 'harness',
          offenders: [{ subject: 'harness', detail: audit.fatal }],
        });
        printRow([combo.label, ...CHECKS.map(() => '-'), '-', '-', 'FAIL'], COLUMN_WIDTHS);
        continue;
      }

      const results = classify(audit);
      const incomplete = countIncomplete(audit);
      incompleteTotal += incomplete;
      openedTotal += audit.opened ?? 0;
      triggersTotal += audit.triggers ?? 0;
      const failed = CHECKS.filter((name) => results[name].length > 0);
      for (const name of failed) {
        failures.push({ label: combo.label, check: name, offenders: results[name] });
      }

      printRow(
        [
          combo.label,
          ...CHECKS.map((name) => (results[name].length === 0 ? 'ok' : String(results[name].length))),
          audit.swept ? String(audit.opened) : '-',
          incomplete === 0 ? '-' : String(incomplete),
          failed.length === 0 ? 'PASS' : 'FAIL',
        ],
        COLUMN_WIDTHS,
      );

      if (options.shots) {
        const file = path.join(SHOTS, `${combo.label.replace(/\//g, '-')}.png`);
        const target = page.locator('#viewport');
        if ((await target.count()) > 0) await target.screenshot({ path: file });
        else await page.screenshot({ path: file });
      }
    }

    const affordance = await resilient(page, state, () => proveAffordance(page));
    console.log('');
    for (const step of affordance) {
      console.log(`${step.ok ? 'ok  ' : 'FAIL'}  F6 reachability · ${step.name}: ${step.detail}`);
      if (!step.ok) {
        failures.push({
          label: 'inbox/comfortable/pointer/light/320',
          check: 'affordance',
          offenders: [{ subject: step.name, detail: step.detail }],
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures.length > 0) {
    console.log('failures\n────────');
    for (const failure of failures) {
      console.log(`${failure.label} · ${failure.check}`);
      for (const offender of failure.offenders) {
        console.log(`    ${offender.subject}`);
        console.log(`      ${offender.detail}`);
      }
    }
    console.log('');
  }
  if (errors.length > 0) {
    console.log(`page errors (${errors.length})\n───────────`);
    for (const error of errors.slice(0, 20)) console.log(`    ${error}`);
    console.log('');
  }

  // A sweep that opened nothing is a sweep that proved nothing. This is the
  // same discipline `no-values-guard.mjs` applies to itself by printing how
  // many literals it still matches inside the theme: a guard that cannot be
  // seen to have done work is indistinguishable from a broken one, and this
  // repository has recorded three false PASSes of exactly that shape. So a run
  // with the overlay pass ON that never opened a door FAILS on its own terms.
  const vacuous = options.overlays && openedTotal === 0;
  if (vacuous) {
    failures.push({
      label: 'overlay pass',
      check: 'vacuity',
      offenders: [
        {
          subject: 'the overlay pass opened nothing',
          detail: `${triggersTotal} revealed trigger(s) across ${combos.length} combination(s) and 0 overlays opened — this run says nothing about overlay content`,
        },
      ],
    });
    console.log('failures\n────────');
    console.log('overlay pass · vacuity');
    console.log('    the overlay pass opened nothing');
    console.log(
      `      ${triggersTotal} revealed trigger(s) across ${combos.length} combination(s) and 0 overlays opened — this run says nothing about overlay content\n`,
    );
  }

  const dirty = new Set(failures.map((failure) => failure.label));
  const verdict = failures.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL';
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `${verdict} — ${combos.length - dirty.size}/${combos.length} combinations clean, ` +
      `${failures.length} assertion failures, ${incompleteTotal} incomplete findings, ${errors.length} page errors` +
      (state.reloads > 0 ? `, ${state.reloads} dev-server reloads recovered from` : ''),
  );
  console.log(
    options.overlays
      ? `overlay pass — ${openedTotal} overlay(s) opened, measured and closed across ${combos.length} combination(s), from ${triggersTotal} revealed trigger(s)`
      : 'overlay pass — not run',
  );
  console.log(`wall clock ${seconds}s`);
  if (options.shots) console.log(`screenshots in ${path.relative(process.cwd(), SHOTS)}/`);
  return verdict === 'PASS' ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   The self-test — the guard on the guard
   ══════════════════════════════════════════════════════════════════════════ */

const INJECTIONS = [
  {
    name: 'declared',
    what: 'makes a declaring element layout-transparent',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      const el = canvas?.querySelector('[data-appearance], [data-text], [data-layout]');
      if (!el) return 'no declaring element on this page';
      el.setAttribute('data-proof-was-style', el.getAttribute('style') ?? '');
      el.style.display = 'contents';
      return true;
    },
  },
  {
    name: 'fit',
    what: 'stamps a container unsatisfiable',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      const el = canvas?.querySelector('[data-fit]');
      if (!el) return 'no [data-fit] container on this page';
      el.setAttribute('data-proof-was-fit', el.getAttribute('data-fit') ?? '');
      el.setAttribute('data-fit', 'unsatisfiable');
      return true;
    },
  },
  {
    name: 'afford',
    what: 'collapses a group without painting its trigger',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      const container = canvas?.querySelector('[data-fit]');
      if (!container) return 'no [data-fit] container on this page';
      const victim = [...container.querySelectorAll('*')].find(
        (el) =>
          el.closest('[data-fit]') === container &&
          !el.hasAttribute('data-collapsed') &&
          !el.hasAttribute('data-overflow'),
      );
      if (!victim) return 'nothing inside the container to mark collapsed';
      victim.setAttribute('data-proof-was-collapsed', '');
      victim.setAttribute('data-collapsed', '');
      return true;
    },
  },
  {
    name: 'crush',
    what: 'adds an element whose content is ten times its box',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      if (!canvas) return 'no canvas';
      const box = document.createElement('div');
      box.setAttribute('data-proof-injected', 'crush');
      box.style.cssText = 'inline-size: 20px; overflow: hidden; white-space: nowrap;';
      const inner = document.createElement('span');
      inner.style.cssText = 'display: inline-block; inline-size: 200px; block-size: 8px;';
      box.append(inner);
      canvas.append(box);
      return true;
    },
  },
  {
    name: 'overlap',
    what: 'pulls one sibling on top of another',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      if (!canvas) return 'no canvas';
      const row = document.createElement('div');
      row.setAttribute('data-proof-injected', 'overlap');
      row.style.cssText = 'display: flex;';
      const first = document.createElement('div');
      first.style.cssText = 'inline-size: 60px; block-size: 20px;';
      const second = document.createElement('div');
      second.style.cssText = 'inline-size: 60px; block-size: 20px; margin-inline-start: -30px;';
      row.append(first, second);
      canvas.append(row);
      return true;
    },
  },
  {
    name: 'document',
    what: 'pushes the document past the window',
    apply: () => {
      const wide = document.createElement('div');
      wide.setAttribute('data-proof-injected', 'document');
      wide.style.cssText = 'inline-size: 6000px; block-size: 1px;';
      document.body.append(wide);
      return true;
    },
  },
  {
    name: 'check',
    what: 'writes a value outside the vocabulary',
    apply: () => {
      const canvas = window.__c11.canvas ?? document.getElementById('canvas');
      const el = canvas?.querySelector('[data-layout]');
      if (!el) return 'no [data-layout] element on this page';
      el.setAttribute('data-proof-was-layout', el.getAttribute('data-layout') ?? '');
      el.setAttribute('data-layout', 'flexbox');
      return true;
    },
  },
  /* ── Three fixtures for the overlay path, one per claim only an open panel
        can answer. Each has to be reachable ONLY while a panel is rendered,
        which is why every one of them is a stylesheet keyed to
        `[data-overflow-menu]`: `when(open, …)` means that selector matches
        nothing at all in the closed document — not a narrower box, not a
        smaller box, literally no element — so the closed-state assertions
        cannot see the defect even in principle. That is what makes these rows
        evidence about the hole rather than only about the check. ── */
  {
    name: 'overlay',
    label: 'overlay/shred',
    what: 'starves an open overlay panel until a label breaks inside itself',
    /**
     * This row is the evidence that the hole was real, so it demands the
     * CONTRAST rather than just a catch: the injected defect must be invisible
     * to all seven closed-state assertions and visible to the overlay pass. A
     * defect that both passes can see would prove the pass works and prove
     * nothing about why it was needed.
     */
    onlyOpenState: true,
    /**
     * Its own baseline candidates, because the shared ones are all wide enough
     * that nothing collapses — no collapsed group means no revealed trigger
     * means no door to open, and a row that opened nothing would read CAUGHT
     * on an empty sweep. 480 is the widest context in the matrix where the
     * inbox toolbar collapses, and the narrower ones are avoided deliberately:
     * they hold a real open-state defect (the message-row panels are clipped
     * away by the surface), and a self-test row that fires on someone else's
     * bug proves nothing about the injection.
     */
    contexts: [
      { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'light', width: 480 },
      { page: 'inbox', density: 'compact', input: 'pointer', theme: 'light', width: 480 },
      { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'dark', width: 480 },
      { page: 'inbox', density: 'comfortable', input: 'touch', theme: 'light', width: 480 },
    ],
    apply: () => {
      const style = document.createElement('style');
      style.setAttribute('data-proof-injected', 'overlay');
      // The P18f defect from the overlays audit, reproduced by hand: forbid the
      // panel its content's width and the labels break inside themselves. The
      // real prototype does not do this — measured, its bound is engaged in 38
      // of 110 opened panels and every label still occupies one line box per
      // word or fewer — so the check is silent on the clean document and this
      // is what proves it is silent because there is nothing there.
      style.textContent =
        '[data-overflow-menu] { inline-size: 4ch !important; min-inline-size: 0 !important; max-inline-size: none !important; }';
      document.head.append(style);
      return true;
    },
  },
  {
    name: 'overlay',
    label: 'overlay/boxless',
    what: 'makes an open panel layout-transparent, so it owns no box',
    onlyOpenState: true,
    contexts: [
      { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'light', width: 480 },
      { page: 'inbox', density: 'compact', input: 'pointer', theme: 'light', width: 480 },
    ],
    apply: () => {
      const style = document.createElement('style');
      style.setAttribute('data-proof-injected', 'overlay-boxless');
      // F4's shape, one level up and inside the overlay: the panel is present,
      // `aria-controls` names it, `checkVisibility()` would call it visible, and
      // it has no geometry at all. This is the exact false PASS the round-2
      // corpus recorded, so the pass has to refuse to measure rather than
      // report a 0-by-0 panel as fine.
      style.textContent = '[data-overflow-menu] { display: contents !important; }';
      document.head.append(style);
      return true;
    },
  },
  {
    name: 'overlay',
    label: 'overlay/unreachable',
    what: 'hides every item inside an open panel, so nothing can be pressed or focused',
    onlyOpenState: true,
    contexts: [
      { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'light', width: 480 },
      { page: 'inbox', density: 'compact', input: 'pointer', theme: 'light', width: 480 },
    ],
    apply: () => {
      const style = document.createElement('style');
      style.setAttribute('data-proof-injected', 'overlay-unreachable');
      // F6, exactly: "a degradation strategy is only honest if the thing it
      // degrades is still available afterwards". A menu that opens onto nothing
      // pressable is the deletion the fit solver is not licensed to make, and
      // the same fixture also breaks the focus claim — `menuItems()[0].focus()`
      // silently does nothing on an unrendered element, so focus stays outside
      // the panel and a keyboard user has nowhere to arrive.
      style.textContent = '[data-overflow-menu] [role="menuitem"] { display: none !important; }';
      document.head.append(style);
      return true;
    },
  },
];

function undoInjections() {
  for (const el of document.querySelectorAll('[data-proof-injected]')) el.remove();
  for (const el of document.querySelectorAll('[data-proof-was-fit]')) {
    el.setAttribute('data-fit', el.getAttribute('data-proof-was-fit') ?? '');
    el.removeAttribute('data-proof-was-fit');
  }
  for (const el of document.querySelectorAll('[data-proof-was-layout]')) {
    el.setAttribute('data-layout', el.getAttribute('data-proof-was-layout') ?? '');
    el.removeAttribute('data-proof-was-layout');
  }
  for (const el of document.querySelectorAll('[data-proof-was-collapsed]')) {
    el.removeAttribute('data-collapsed');
    el.removeAttribute('data-proof-was-collapsed');
  }
  for (const el of document.querySelectorAll('[data-proof-was-style]')) {
    const original = el.getAttribute('data-proof-was-style') ?? '';
    if (original) el.setAttribute('style', original);
    else el.removeAttribute('style');
    el.removeAttribute('data-proof-was-style');
  }
}

/**
 * The self-test needs a context where every assertion is already quiet, or a
 * row cannot distinguish "the proof caught my defect" from "the page was
 * already broken there". A real defect elsewhere in the app must not be able
 * to disable the guard on the guard, so candidates are probed widest-first
 * until one is clean, and the one used is printed.
 */
const BASELINES = [
  { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
  { page: 'inbox', density: 'comfortable', input: 'pointer', theme: 'light', width: 720 },
  { page: 'data', density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
  { page: 'settings', density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
  { page: 'marketing', density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
];

/**
 * Probe `candidates` in order and answer with the first context on which every
 * assertion is quiet, together with that measurement.
 *
 * `wants` is the extra condition a row may need before its baseline counts:
 * the overlay row demands that the sweep actually opened a door there, because
 * a clean-and-empty sweep is the vacuous PASS this whole file exists to refuse.
 */
async function findBaseline(page, state, candidates, wants) {
  let last = null;
  for (const candidate of candidates) {
    const audit = await resilient(page, state, async () => {
      await applyContext(page, candidate);
      return page.evaluate(auditInPage, { overlays: true });
    });
    if (audit.fatal) return { fatal: audit.fatal };
    const results = classify(audit);
    last = { context: candidate, audit, results };
    if (!CHECKS.every((name) => results[name].length === 0)) continue;
    if (wants && !wants(audit)) continue;
    return { ...last, clean: true };
  }
  return { ...last, clean: false };
}

async function runSelfTest(options) {
  const { browser, page } = await openHarness(options);
  const rows = [];
  const state = { reloads: 0 };
  let broken = 0;

  console.log(`c11 geometry proof — self-test against ${options.url}`);

  try {
    const shared = await findBaseline(page, state, BASELINES);
    if (shared.fatal) {
      console.error(`self-test cannot run: ${shared.fatal}`);
      return 1;
    }
    const sharedLabel = Object.values(shared.context).join('/');
    const dirtyAtBaseline = CHECKS.filter((name) => shared.results[name].length > 0);
    console.log(
      dirtyAtBaseline.length === 0
        ? `baseline context ${sharedLabel} — clean on all ${CHECKS.length} assertions\n`
        : `baseline context ${sharedLabel} — no candidate was clean; ${dirtyAtBaseline.join(', ')} already failing\n`,
    );

    for (const injection of INJECTIONS) {
      // A row may need a context of its own. Every overlay row does: the shared
      // candidates are all wide enough that nothing collapses, so no trigger is
      // revealed and there would be no door for the injection to be found
      // behind. Its baseline is chosen the same way and reported the same way,
      // and it additionally requires that the sweep opened something — a clean
      // and empty sweep would read CAUGHT on nothing at all.
      let baseline = shared;
      if (injection.contexts) {
        baseline = await findBaseline(page, state, injection.contexts, (audit) => audit.opened > 0);
        if (baseline.fatal) {
          console.error(`self-test cannot run: ${baseline.fatal}`);
          return 1;
        }
        if (!baseline.clean) {
          const loud = CHECKS.filter((name) => baseline.results[name].length > 0);
          rows.push({
            name: injection.label ?? injection.name,
            verdict: 'INCONCLUSIVE',
            note:
              loud.length > 0
                ? `no candidate context was clean; nearest (${Object.values(baseline.context).join('/')}) already reporting ${loud.join(', ')}`
                : `no candidate context revealed an overlay to open (nearest ${Object.values(baseline.context).join('/')} opened ${baseline.audit.opened})`,
          });
          broken += 1;
          continue;
        }
        console.log(
          `${injection.label ?? injection.name}: own baseline ${Object.values(baseline.context).join('/')} — clean on all ${CHECKS.length} assertions, ${baseline.audit.opened} overlay(s) opened`,
        );
      }

      // Every row rests on the assertion being quiet before the defect goes
      // in. If it is already loud, the row proves nothing either way.
      if (baseline.results[injection.name].length > 0) {
        rows.push({
          name: injection.label ?? injection.name,
          verdict: 'INCONCLUSIVE',
          note: `already reporting ${baseline.results[injection.name].length} offender(s) at baseline`,
        });
        broken += 1;
        continue;
      }

      // The whole inject/measure/undo sequence is one unit: a dev-server
      // reload in the middle would silently wash the injection away and the
      // row would read BLIND, blaming the proof for the tooling.
      const attempt = await resilient(page, state, async () => {
        const applied = await page.evaluate(injection.apply);
        if (applied !== true) return { applied };
        const dirty = classify(await page.evaluate(auditInPage, { overlays: true }));
        await page.evaluate(undoInjections);
        // Removing the attribute is not the same as undoing its consequences:
        // a broken layout makes the solver spend degradations, and those
        // outlive the attribute. Let it re-solve, then measure — otherwise
        // every row after the first reads STICKY and the self-test blames the
        // proof for damage the injection did to the page.
        await page.evaluate(() => window.__c11.settled());
        return {
          applied,
          dirty,
          restored: classify(await page.evaluate(auditInPage, { overlays: true })),
        };
      });
      if (attempt.applied !== true) {
        rows.push({ name: injection.label ?? injection.name, verdict: 'INCONCLUSIVE', note: String(attempt.applied) });
        broken += 1;
        continue;
      }
      const { dirty, restored } = attempt;

      if (dirty[injection.name].length === 0) {
        rows.push({
          name: injection.label ?? injection.name,
          verdict: 'BLIND',
          note: `${injection.what} — the proof did not notice`,
        });
        broken += 1;
        continue;
      }
      // The contrast, and it is the point of the overlay row rather than a
      // nicety. If the seven closed-state assertions can also see the defect
      // then the injection was reachable with the door shut, the row says
      // nothing about whether opening it mattered, and the claim that the
      // matrix had a hole in it is unevidenced.
      if (injection.onlyOpenState) {
        const leaked = CLOSED_CHECKS.filter((name) => dirty[name].length > 0);
        if (leaked.length > 0) {
          rows.push({
            name: injection.label ?? injection.name,
            verdict: 'LEAKED',
            note: `${injection.what} — also visible to the closed-state assertion(s) ${leaked.join(', ')}, so this row proves nothing about the open state`,
          });
          broken += 1;
          continue;
        }
      }
      if (restored[injection.name].length > 0) {
        rows.push({
          name: injection.label ?? injection.name,
          verdict: 'STICKY',
          note: 'still reporting after the defect was removed',
        });
        broken += 1;
        continue;
      }
      rows.push({
        name: injection.label ?? injection.name,
        verdict: 'CAUGHT',
        note:
          `${injection.what} → ${dirty[injection.name].length} offender(s), first: ${dirty[injection.name][0].subject}` +
          (injection.onlyOpenState ? '; all 7 closed-state assertions silent on the same document' : ''),
      });
    }
  } finally {
    await browser.close();
  }

  const widths = [20, 14, 110];
  console.log('');
  printRow(['assertion', 'verdict', 'evidence'], widths);
  printRow(['─────────', '───────', '────────'], widths);
  for (const row of rows) printRow([row.name, row.verdict, row.note], widths);

  console.log('');
  console.log(
    (broken === 0
      ? `PASS — all ${rows.length} assertion paths fail when they should. This proof is a guard, not decoration.`
      : `FAIL — ${broken}/${rows.length} assertion paths could not be shown to fail.`) +
      (state.reloads > 0 ? ` (${state.reloads} dev-server reloads recovered from)` : ''),
  );
  return broken === 0 ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════ */

const options = parseArgs(process.argv.slice(2));
process.exitCode = options.selfTest ? await runSelfTest(options) : await runMatrix(options);
