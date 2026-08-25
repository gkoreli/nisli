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
 * Six assertions per combination:
 *
 *   declared  every appearance declaration sits on an element that owns a box
 *   fit       every [data-fit] container reports settled
 *   crush     nothing inside the canvas paints outside its own box (F8)
 *   overlap   no two rendered siblings' boxes intersect (F8, the visible half)
 *   document  the document does not exceed the window
 *   check     the derived checker reports no failures
 *
 * `--self-test` is the guard on the guard. This repository has three recorded
 * false-PASS oracles; a proof that cannot fail is decoration. The self-test
 * breaks each assertion path in turn and requires the proof to notice.
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

const CHECKS = ['declared', 'fit', 'crush', 'overlap', 'document', 'check'];

/* ══════════════════════════════════════════════════════════════════════════
   Arguments
   ══════════════════════════════════════════════════════════════════════════ */

const USAGE =
  'usage: geometry-proof.mjs [--url URL] [--filter SUBSTRING] [--viewport WxH] [--no-shots] [--headed] [--self-test]';

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:5199',
    filter: '',
    viewport: { width: 1280, height: 900 },
    shots: true,
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

function auditInPage() {
  const api = window.__c11;
  if (typeof api?.check !== 'function') return { fatal: 'window.__c11.check is missing' };
  const canvas = api.canvas ?? document.getElementById('canvas');
  if (!canvas) return { fatal: 'no canvas element: the harness did not mount' };

  const DECLARATIONS = ['data-appearance', 'data-text', 'data-layout', 'data-collapse', 'data-grow'];

  const describe = (el) => {
    let out = el.tagName.toLowerCase();
    if (el.id) out += `#${el.id}`;
    for (const name of ['data-appearance', 'data-text', 'data-layout', 'data-role', 'data-fit']) {
      const value = el.getAttribute(name);
      if (value !== null) out += `[${name}="${value}"]`;
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
    if (el.getClientRects().length === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

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

  /* ── crush ─────────────────────────────────────────────────────────── */
  // This mirrors N660, not domMetrics.crushed(). The two differ on one point:
  // the solver exempts `overflow: hidden`/`clip` because a clipped box is not
  // its problem, while the checker still fails it because clipped content is
  // unreadable content. The assertion being made here is "nothing on screen is
  // unreadable", so the checker's spelling is the right one. Shared with both:
  // declared truncation, the overflow menu, a text field (an input scrolls its
  // own value), and real scrollers. Boxless nodes need no rule; they report 0/0.
  const crush = [];
  for (const el of canvas.querySelectorAll('*')) {
    if (el.closest('[data-escaped]')) continue;
    if (el.hasAttribute('data-truncate')) continue;
    if (el.getAttribute('data-appearance') === 'field') continue;
    if (el.closest('[data-overflow-menu]')) continue;
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

  const overlap = [];
  const seen = new Set();
  for (const container of [canvas, ...canvas.querySelectorAll('*')]) {
    if (container.closest('[data-escaped]')) continue;
    if (container.closest('[data-overflow-menu]')) continue;
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
  const findings = api.check().map((f) => ({
    code: f.code,
    severity: f.severity,
    subject: f.subject,
    detail: f.detail,
  }));

  return {
    declared,
    fit,
    crush,
    overlap,
    document: documentIssues,
    findings,
    escapes: canvas.querySelectorAll('[data-escaped]').length,
  };
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

function classify(audit) {
  return {
    declared: audit.declared,
    fit: audit.fit,
    crush: audit.crush,
    overlap: audit.overlap,
    document: audit.document,
    check: classifyFindings(audit),
  };
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

const HEADERS = ['context', ...CHECKS, 'incompl', 'result'];
const COLUMN_WIDTHS = [40, 8, 4, 5, 7, 8, 5, 7, 6];

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
    await rm(SHOTS, { recursive: true, force: true });
    await mkdir(SHOTS, { recursive: true });
  }

  const { browser, page, errors } = await openHarness(options);
  const failures = [];
  const state = { reloads: 0 };
  let incompleteTotal = 0;

  console.log(`c11 geometry proof — ${combos.length} combinations against ${options.url}`);
  console.log(
    `browser viewport ${options.viewport.width}x${options.viewport.height}; the harness width is driven through setContext\n`,
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
        return page.evaluate(auditInPage);
      });
      if (audit.fatal) {
        failures.push({
          label: combo.label,
          check: 'harness',
          offenders: [{ subject: 'harness', detail: audit.fatal }],
        });
        printRow([combo.label, ...CHECKS.map(() => '-'), '-', 'FAIL'], COLUMN_WIDTHS);
        continue;
      }

      const results = classify(audit);
      const incomplete = audit.findings.filter((f) => f.severity === 'incomplete').length;
      incompleteTotal += incomplete;
      const failed = CHECKS.filter((name) => results[name].length > 0);
      for (const name of failed) {
        failures.push({ label: combo.label, check: name, offenders: results[name] });
      }

      printRow(
        [
          combo.label,
          ...CHECKS.map((name) => (results[name].length === 0 ? 'ok' : String(results[name].length))),
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

  const dirty = new Set(failures.map((failure) => failure.label));
  const verdict = failures.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL';
  console.log(
    `${verdict} — ${combos.length - dirty.size}/${combos.length} combinations clean, ` +
      `${failures.length} assertion failures, ${incompleteTotal} incomplete findings, ${errors.length} page errors` +
      (state.reloads > 0 ? `, ${state.reloads} dev-server reloads recovered from` : ''),
  );
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

async function runSelfTest(options) {
  const { browser, page } = await openHarness(options);
  const rows = [];
  const state = { reloads: 0 };
  let broken = 0;

  console.log(`c11 geometry proof — self-test against ${options.url}`);

  try {
    let baseline = BASELINES[0];
    let cleanResults = null;
    for (const candidate of BASELINES) {
      const audit = await resilient(page, state, async () => {
        await applyContext(page, candidate);
        return page.evaluate(auditInPage);
      });
      if (audit.fatal) {
        console.error(`self-test cannot run: ${audit.fatal}`);
        return 1;
      }
      const results = classify(audit);
      baseline = candidate;
      cleanResults = results;
      if (CHECKS.every((name) => results[name].length === 0)) break;
    }
    const label = Object.values(baseline).join('/');
    const dirtyAtBaseline = CHECKS.filter((name) => cleanResults[name].length > 0);
    console.log(
      dirtyAtBaseline.length === 0
        ? `baseline context ${label} — clean on all ${CHECKS.length} assertions\n`
        : `baseline context ${label} — no candidate was clean; ${dirtyAtBaseline.join(', ')} already failing\n`,
    );

    for (const injection of INJECTIONS) {
      // Every row rests on the assertion being quiet before the defect goes
      // in. If it is already loud, the row proves nothing either way.
      if (cleanResults[injection.name].length > 0) {
        rows.push({
          name: injection.name,
          verdict: 'INCONCLUSIVE',
          note: `already reporting ${cleanResults[injection.name].length} offender(s) at baseline`,
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
        const dirty = classify(await page.evaluate(auditInPage));
        await page.evaluate(undoInjections);
        return { applied, dirty, restored: classify(await page.evaluate(auditInPage)) };
      });
      if (attempt.applied !== true) {
        rows.push({ name: injection.name, verdict: 'INCONCLUSIVE', note: String(attempt.applied) });
        broken += 1;
        continue;
      }
      const { dirty, restored } = attempt;

      if (dirty[injection.name].length === 0) {
        rows.push({
          name: injection.name,
          verdict: 'BLIND',
          note: `${injection.what} — the proof did not notice`,
        });
        broken += 1;
        continue;
      }
      if (restored[injection.name].length > 0) {
        rows.push({
          name: injection.name,
          verdict: 'STICKY',
          note: 'still reporting after the defect was removed',
        });
        broken += 1;
        continue;
      }
      rows.push({
        name: injection.name,
        verdict: 'CAUGHT',
        note: `${injection.what} → ${dirty[injection.name].length} offender(s), first: ${dirty[injection.name][0].subject}`,
      });
    }
  } finally {
    await browser.close();
  }

  const widths = [10, 14, 110];
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
