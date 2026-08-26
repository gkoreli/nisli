#!/usr/bin/env node
/**
 * state-sweep.mjs — the third charter item, as a measurement.
 *
 * THE CLAIM UNDER TEST. Appearance is a function of declared meaning and
 * context. If that is true, then STATE is declarable too — an empty corpus, a
 * failed load, one item, two dozen items, hostile content — and once it is
 * declared the engine can render every one of them and the checker can sweep
 * all of them, including the ones no human ever opens. `geometry-proof.mjs`
 * sweeps 240 combinations of exactly ONE state: the happy path with four seeded
 * rows. Every defect it has ever caught was in geometry it happened to render.
 *
 * THE NUMBER THIS SCRIPT EXISTS TO PRODUCE. How many defects does sweeping
 * declared states find that sweeping contexts does not? If the answer is zero,
 * the item is dead and that is a perfectly good result — so the run prints the
 * `ready`-state control beside every other state, and a defect only counts as
 * state-found when it is silent on `ready` in the same context. Anything else
 * would be this script taking credit for the matrix's work.
 *
 * It starts nothing. Point it at a running dev server:
 *
 *   pnpm --filter @nisli/experiment-c11-appearance dev     # in another shell
 *   node proof/state-sweep.mjs
 *   node proof/state-sweep.mjs --full          # every context, not the subset
 *   node proof/state-sweep.mjs --filter inbox/many
 *   node proof/state-sweep.mjs --self-test
 *
 * WHY A SUBSET OF CONTEXTS, AND WHICH ONE. Twenty declared page/state pairs
 * times the matrix's sixty contexts is 1200 cells for a question that does not
 * obviously need them. Most contexts differ from a neighbour only in an axis
 * whose interaction with state looked like nil: `compact` is interior to
 * comfortable and dense on every value the table derives, and 720/480/360 are
 * interior to 1080 and 320 on width. So four axes are pinned at their EXTREMES,
 * which is where this experiment's defects have actually lived — F8 at 320, F9
 * at dense/320, the hit-target floor at touch:
 *
 *   comfortable/pointer/light/1080  the most forgiving cell there is. A failure
 *                                   here is a defect that has nothing to do
 *                                   with space, which is exactly the kind an
 *                                   unlooked-at state hides.
 *   dense/pointer/light/320         narrowest and densest — the F9 cell, where
 *                                   derivation from one unit was measurably
 *                                   self-contradictory.
 *   comfortable/touch/light/320     narrowest against the LARGEST hit-target
 *                                   floor: floor and space maximally opposed.
 *   dense/pointer/dark/320          the same extreme in the other theme,
 *                                   because contrast (N640) is the one rule
 *                                   whose verdict is a function of theme and
 *                                   nothing else.
 *
 * AND THEN A FIFTH, WHICH IS AN INTERIOR POINT, BECAUSE THE ARGUMENT ABOVE WAS
 * MEASURED AND FOUND WRONG. This paragraph used to read: "an interior point
 * cannot fail an assertion both endpoints pass unless the derivation is
 * NON-MONOTONIC in that axis … `--full` exists to spend the 5x and check it."
 * It is kept rather than deleted because the refutation is the interesting part.
 * `--full` was run: 1200 cells in 42.8 seconds, and it found FIVE distinct
 * state-only defects where the four extremes found four. The fifth lives at
 * width 480 and nowhere near either endpoint — an overflow panel clipped away
 * while the menu is open, in the hostile state, where the same panel at 1080 has
 * room and at 320 is already reported by the control. So:
 *
 *   comfortable/pointer/light/480   the interior width that empirically caught
 *                                   a defect both endpoints missed. Extremes
 *                                   are where THIS prototype's defects have
 *                                   lived; they are not where defects must live,
 *                                   and one measurement was enough to show it.
 *
 * The honest reading of that number is that the subset argument is weak on its
 * own merits: `--full` costs forty-three seconds. The subset earns its keep as
 * the fast loop, not as the trustworthy run, and any reported result should say
 * which one produced it.
 *
 * WHAT IS ASSERTED PER CELL. The full rule set, through the same
 * `window.__c11.check` the matrix's `check` column and the Run check button
 * call — including the open-overlay pass, so a panel that only exists while a
 * menu is open is measured in every state rather than only in `ready`. Plus two
 * structural assertions the rule set cannot express, copied in intent from the
 * matrix: `declared` (a declaration on a boxless element) and `afford` (a
 * collapsed group whose trigger is not reachable). The four geometric
 * assertions the matrix also runs by hand — fit, crush, overlap, document — are
 * NOT re-implemented here: N620, N660, N670 and N630 assert the same facts
 * through the shared rule set, and a second hand-rolled copy of an oracle in a
 * new file is a second oracle to keep truthful for no new coverage. Six of this
 * repository's ten recorded defects were in the oracle.
 */
import { chromium } from 'playwright';

/**
 * The chosen contexts: four extremes plus one interior point that a `--full`
 * run proved the extremes could not cover. `why` is carried into the report
 * because a subset that cannot say why it is a subset is a subset nobody can
 * argue with.
 */
const CONTEXTS = [
  {
    label: 'wide',
    why: 'the most forgiving cell: a failure here is not about space',
    context: { density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
  },
  {
    label: 'dense-narrow',
    why: 'narrowest and densest — the F9 cell',
    context: { density: 'dense', input: 'pointer', theme: 'light', width: 320 },
  },
  {
    label: 'touch-narrow',
    why: 'narrowest against the largest hit-target floor',
    context: { density: 'comfortable', input: 'touch', theme: 'light', width: 320 },
  },
  {
    label: 'dense-narrow-dark',
    why: 'the same extreme in the other theme, for N640',
    context: { density: 'dense', input: 'pointer', theme: 'dark', width: 320 },
  },
  {
    label: 'mid',
    why: 'the interior width where --full found a defect both endpoints missed',
    context: { density: 'comfortable', input: 'pointer', theme: 'light', width: 480 },
  },
];

/** `--full`: the matrix's own axes, so the subset is a default and not a ceiling. */
const FULL_DENSITIES = ['comfortable', 'compact', 'dense'];
const FULL_INPUTS = ['pointer', 'touch'];
const FULL_THEMES = ['light', 'dark'];
const FULL_WIDTHS = [1080, 720, 480, 360, 320];

/** The control. A defect that also fires here belongs to the context matrix. */
const CONTROL_STATE = 'ready';

/* ══════════════════════════════════════════════════════════════════════════
   Arguments
   ══════════════════════════════════════════════════════════════════════════ */

const USAGE =
  'usage: state-sweep.mjs [--url URL] [--filter SUBSTRING] [--viewport WxH] [--full] [--headed] [--self-test]';

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:5199',
    filter: '',
    viewport: { width: 1280, height: 900 },
    full: false,
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
      case '--full':
        options.full = true;
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
   Reading the declaration out of the running app
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The page list and each page's declared states are READ FROM THE APP, never
 * copied into this file. `geometry-proof.mjs` hardcodes its axes and gets away
 * with it because the vocabulary axes are frozen; the state space is new and
 * still moving, and a sweep whose list has drifted from the app's list reports
 * cells it never rendered — a false PASS with a full-looking table, which is the
 * exact shape of three defects already on record here.
 *
 * The harness prints both into `#declared-states`, outside the canvas, because
 * the canvas is the thing under test and the harness is allowed to be told.
 */
function readDeclarationInPage() {
  const nav = [...document.querySelectorAll('#controls [data-appearance="nav-item"]')];
  const pages = nav.map((el) => (el.textContent ?? '').trim()).filter(Boolean);
  const readout = document.getElementById('declared-states');
  return { pages, readout: (readout?.textContent ?? '').trim() };
}

/** `page inbox · state ready · declares a,b,c` → the three fields. */
function parseReadout(text) {
  const match = /^page (\S+) · state (\S+) · declares (\S+)$/u.exec(text);
  if (!match) return null;
  return { page: match[1], state: match[2], declares: match[3].split(',') };
}

/* ══════════════════════════════════════════════════════════════════════════
   The in-page audit
   ══════════════════════════════════════════════════════════════════════════ */

function auditInPage() {
  const api = window.__c11;
  if (typeof api?.check !== 'function') return { fatal: 'window.__c11.check is missing' };
  const canvas = api.canvas ?? document.getElementById('canvas');
  if (!canvas) return { fatal: 'no canvas element: the harness did not mount' };

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

  const boxed = (el) => {
    if (el === null || el.getClientRects().length === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  /* ── declared: a declaration on an element that owns no box ─────────── */
  const DECLARATIONS = ['data-appearance', 'data-text', 'data-layout', 'data-collapse', 'data-grow'];
  const declared = [];
  for (const el of canvas.querySelectorAll('*')) {
    if (getComputedStyle(el).display !== 'contents') continue;
    const carried = DECLARATIONS.filter((name) => el.hasAttribute(name));
    if (carried.length === 0) continue;
    declared.push({
      subject: describe(el),
      detail: `carries ${carried.join(', ')} while being display: contents — no theme rule keyed to that declaration can size it`,
    });
  }

  /* ── afford: a collapsed group the reader cannot get back ───────────── */
  const afford = [];
  for (const container of canvas.querySelectorAll('[data-fit]')) {
    const mine = (el) => el.closest('[data-fit]') === container;
    const collapsed = [...container.querySelectorAll('[data-collapsed]')].filter(mine).length;
    const trigger = [...container.querySelectorAll('[data-overflow]')].find(mine) ?? null;
    const shown = trigger !== null && trigger.hasAttribute('data-shown');
    if (collapsed > 0 && trigger === null) {
      afford.push({
        subject: describe(container),
        detail: `${collapsed} group(s) moved into a menu with no [data-overflow] trigger — those actions are unreachable`,
      });
    } else if (collapsed > 0 && !shown) {
      afford.push({
        subject: describe(container),
        detail: `${collapsed} group(s) moved into a menu but the trigger is not marked data-shown`,
      });
    } else if (collapsed > 0 && !boxed(trigger)) {
      afford.push({
        subject: describe(container),
        detail: 'the trigger is marked data-shown but owns no box, so it is neither in the measured geometry nor clickable',
      });
    } else if (collapsed === 0 && shown && boxed(trigger)) {
      afford.push({
        subject: describe(container),
        detail: 'the overflow trigger is painted while nothing is collapsed — inline space spent on an affordance that leads nowhere',
      });
    }
  }

  /* ── the doors, counted before they are opened ──────────────────────── */
  // A vacuity guard, and the reason it is here rather than inferred from the
  // findings: `check({ overlays: true })` reporting nothing is two different
  // facts depending on whether there was a door to open, and a sweep that
  // cannot tell them apart is a sweep that can pass by rendering nothing.
  const doors = canvas.querySelectorAll('[data-overflow][data-shown]').length;

  /* ── the full rule set, closed door and open ────────────────────────── */
  const findings = api.check(canvas, { overlays: true }).map((f) => ({
    code: f.code,
    severity: f.severity,
    subject: f.subject,
    detail: f.detail,
  }));

  return {
    declared,
    afford,
    doors,
    findings,
    escapes: canvas.querySelectorAll('[data-escaped]').length,
    // A crude fingerprint of what was rendered, so the self-test can prove that
    // a declared state changed something. Element count alone would miss a
    // corpus swap; text length alone would miss a structural one.
    signature: `${canvas.querySelectorAll('*').length}/${(canvas.textContent ?? '').length}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Classification — identical rules to the matrix, so the numbers compare
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The escape hatch reporting itself is the escape hatch working (F7), so N601
 * warnings are allowed by CODE and tied to STRUCTURE: one per `[data-escaped]`
 * subtree actually present. Same treatment as the matrix, deliberately — the
 * two runs are only comparable if they forgive the same things.
 *
 * `key` IS DELIBERATELY CODE PLUS SUBJECT AND NOT THE DETAIL, which is the
 * opposite of the choice `checkNow` makes when it dedupes an overlay pass. The
 * two are answering different questions. There, magnitude is a new FACT and
 * must survive. Here, the key is the subtrahend in "what does this state find
 * that the happy path does not", and a state that clips the same box by a
 * bigger overhang has not found a new defect — it has found a bigger witness
 * for the matrix's defect. Including the detail would let every state claim
 * credit for the control's findings at a different number, which is exactly the
 * inflation this script is built to avoid. The cost is stated rather than
 * hidden: the sweep UNDER-reports whenever a genuinely different element shares
 * a code and a subject string with a control offender, and it can never
 * over-report.
 */
function classifyFindings(audit) {
  const offenders = [];
  let escapeWarnings = 0;
  for (const finding of audit.findings) {
    if (finding.severity === 'fail') {
      offenders.push({
        key: `${finding.code}\u0000${finding.subject}`,
        subject: `${finding.code} ${finding.subject}`,
        detail: finding.detail,
      });
      continue;
    }
    if (finding.severity !== 'warn') continue;
    if (finding.code === 'N601') {
      escapeWarnings += 1;
      continue;
    }
    offenders.push({
      key: `${finding.code}\u0000${finding.subject}`,
      subject: `${finding.code} ${finding.subject}`,
      detail: `unexpected warning — only the escape hatch (N601) is allowlisted: ${finding.detail}`,
    });
  }
  if (escapeWarnings !== audit.escapes) {
    offenders.push({
      key: 'N601\u0000allowlist',
      subject: 'N601 allowlist',
      detail: `${escapeWarnings} escape warnings for ${audit.escapes} [data-escaped] subtrees — the allowlist is keyed to structure, not to a count`,
    });
  }
  return offenders;
}

const CHECKS = ['declared', 'afford', 'check'];

function classify(audit) {
  return {
    declared: audit.declared.map((o) => ({ ...o, key: `declared\u0000${o.subject}` })),
    afford: audit.afford.map((o) => ({ ...o, key: `afford\u0000${o.subject}` })),
    check: classifyFindings(audit),
  };
}

/** Every offender across every assertion, as a flat keyed list. */
function offendersOf(results) {
  return CHECKS.flatMap((name) => results[name].map((o) => ({ ...o, check: name })));
}

/* ══════════════════════════════════════════════════════════════════════════
   Driving
   ══════════════════════════════════════════════════════════════════════════ */

const LOST_CONTEXT = /Execution context was destroyed|frame was detached|Cannot find context|Target closed/i;

async function applyContext(page, patch) {
  await page.evaluate(async (value) => {
    window.__c11.setContext(value);
    await window.__c11.settled();
  }, patch);
}

/** Same reasoning as the matrix: a dev-server reload is the tool losing its
 *  grip on the page, not a defect in the page. Re-attach and measure again. */
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
 * Ask the app which pages exist and, for each, which states it claims. Two
 * round trips per page and no duplicated declaration anywhere in this file.
 */
async function readDeclaration(page, state) {
  const { pages } = await resilient(page, state, () => page.evaluate(readDeclarationInPage));
  if (pages.length === 0) throw new Error('no nav items in #controls: the harness did not mount its page list');
  const declared = [];
  for (const id of pages) {
    await applyContext(page, { page: id });
    const { readout } = await resilient(page, state, () => page.evaluate(readDeclarationInPage));
    const parsed = parseReadout(readout);
    if (!parsed) throw new Error(`#declared-states did not parse for page ${id}: "${readout}"`);
    if (parsed.page !== id) throw new Error(`asked for page ${id}, harness reports ${parsed.page}`);
    declared.push({ page: id, states: parsed.declares });
  }
  return declared;
}

function contextsFor(options) {
  if (!options.full) return CONTEXTS;
  const out = [];
  for (const density of FULL_DENSITIES) {
    for (const input of FULL_INPUTS) {
      for (const theme of FULL_THEMES) {
        for (const width of FULL_WIDTHS) {
          out.push({
            label: `${density}/${input}/${theme}/${width}`,
            why: 'every context, --full',
            context: { density, input, theme, width },
          });
        }
      }
    }
  }
  return out;
}

/**
 * Cells are ordered CONTEXT-major with the control state first inside each
 * context, because the whole comparison is "was this already broken on the
 * happy path in this very cell". Measuring the control in a different context
 * would answer a different question.
 *
 * `--filter` NEVER REMOVES A CONTROL. The control is machinery, not a cell
 * anybody asked to see: without it the subtraction has nothing to subtract, and
 * `--filter inbox/hostile` used to abort on exactly that. Two wrong fixes were
 * available and both would have been worse than the crash — guessing that a
 * filtered cell has no control offenders would silently credit this sweep with
 * the matrix's defects, and reusing a control measured in another context would
 * compare two different geometries. So the control is measured whenever any
 * state cell in its page and context survives the filter, and it is measured
 * there and nowhere else.
 */
function buildCells(declared, contexts, filter) {
  const cells = [];
  for (const ctx of contexts) {
    for (const { page: id, states } of declared) {
      const wanted = states.filter(
        (state) => state !== CONTROL_STATE && (!filter || `${id}/${state}/${ctx.label}`.includes(filter)),
      );
      if (wanted.length === 0) continue;
      for (const state of [CONTROL_STATE, ...wanted]) {
        cells.push({
          label: `${id}/${state}/${ctx.label}`,
          page: id,
          state,
          ctx,
          control: state === CONTROL_STATE,
        });
      }
    }
  }
  return cells;
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

const HEADERS = ['cell', 'declared', 'afford', 'check', 'doors', 'new', 'result'];
const COLUMN_WIDTHS = [42, 8, 6, 5, 5, 3, 6];

/* ══════════════════════════════════════════════════════════════════════════
   The sweep
   ══════════════════════════════════════════════════════════════════════════ */

async function runSweep(options) {
  const started = Date.now();
  const { browser, page, errors } = await openHarness(options);
  const state = { reloads: 0 };
  const contexts = contextsFor(options);

  let cells;
  let declared;
  try {
    declared = await readDeclaration(page, state);
    cells = buildCells(declared, contexts, options.filter);
  } catch (error) {
    await browser.close();
    console.error(String(error));
    return 1;
  }
  if (cells.length === 0) {
    await browser.close();
    console.error(`no cell matches --filter ${options.filter}`);
    return 1;
  }

  console.log(`c11 state sweep — ${cells.length} cells against ${options.url}`);
  console.log(
    `${declared.map((entry) => `${entry.page}:${entry.states.length}`).join(' ')} declared states ` +
      `× ${contexts.length} context${contexts.length === 1 ? '' : 's'}` +
      (options.full ? ' (--full)' : ''),
  );
  for (const ctx of contexts.slice(0, options.full ? 0 : contexts.length)) {
    console.log(`  ${ctx.label.padEnd(18)} ${Object.values(ctx.context).join('/')} — ${ctx.why}`);
  }
  console.log('');
  printRow(HEADERS, COLUMN_WIDTHS);
  printRow(
    HEADERS.map((header) => '─'.repeat(header.length)),
    COLUMN_WIDTHS,
  );

  /** Offender keys the control state produced, per context. The subtraction. */
  const controlKeys = new Map();
  const stateFound = [];
  const controlFailures = [];
  let doorsTotal = 0;
  let incompleteTotal = 0;

  try {
    for (const cell of cells) {
      const audit = await resilient(page, state, async () => {
        await applyContext(page, { page: cell.page, state: cell.state, ...cell.ctx.context });
        return page.evaluate(auditInPage);
      });
      if (audit.fatal) {
        controlFailures.push({ label: cell.label, offenders: [{ subject: 'harness', detail: audit.fatal }] });
        printRow([cell.label, '-', '-', '-', '-', '-', 'FAIL'], COLUMN_WIDTHS);
        continue;
      }

      const results = classify(audit);
      const offenders = offendersOf(results);
      doorsTotal += audit.doors;
      incompleteTotal += audit.findings.filter((f) => f.severity === 'incomplete').length;

      const contextKey = `${cell.page}/${cell.ctx.label}`;
      let fresh = offenders;
      if (cell.control) {
        controlKeys.set(contextKey, new Set(offenders.map((o) => o.key)));
        if (offenders.length > 0) controlFailures.push({ label: cell.label, offenders });
        fresh = [];
      } else {
        const seen = controlKeys.get(contextKey);
        if (seen === undefined) {
          // The control must precede its states in the same context, or the
          // subtraction is a guess. buildCells guarantees it; this is the
          // assertion that the guarantee held.
          throw new Error(`no control measurement for ${contextKey} before ${cell.label}`);
        }
        fresh = offenders.filter((o) => !seen.has(o.key));
        for (const offender of fresh) {
          stateFound.push({
            page: cell.page,
            state: cell.state,
            context: cell.ctx,
            check: offender.check,
            subject: offender.subject,
            detail: offender.detail,
          });
        }
      }

      printRow(
        [
          cell.label + (cell.control ? ' (control)' : ''),
          results.declared.length === 0 ? 'ok' : String(results.declared.length),
          results.afford.length === 0 ? 'ok' : String(results.afford.length),
          results.check.length === 0 ? 'ok' : String(results.check.length),
          String(audit.doors),
          cell.control ? '-' : String(fresh.length),
          // Three outcomes, not two. A state cell that reports the SAME
          // offender its control already reported is not a find — it is the
          // context matrix's defect showing up again — and printing STATE
          // there would inflate the one number this script exists to produce.
          offenders.length === 0
            ? 'clean'
            : cell.control
              ? 'CONTROL'
              : fresh.length > 0
                ? 'STATE'
                : 'known',
        ],
        COLUMN_WIDTHS,
      );
    }
  } finally {
    await browser.close();
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');

  if (controlFailures.length > 0) {
    console.log(`control-state offenders — these belong to the context matrix, not to this sweep\n───────`);
    for (const failure of controlFailures) {
      console.log(`${failure.label}`);
      for (const offender of failure.offenders) {
        console.log(`    ${offender.subject}`);
        console.log(`      ${offender.detail}`);
      }
    }
    console.log('');
  }

  // Grouped by the fact, because the same defect in four contexts is one defect
  // with four witnesses, and reporting it as four inflates the one number this
  // script exists to produce.
  const grouped = new Map();
  for (const found of stateFound) {
    const key = `${found.check}\u0000${found.subject}\u0000${found.state}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.contexts.push(found.context.label);
    else grouped.set(key, { ...found, contexts: [found.context.label] });
  }

  if (grouped.size > 0) {
    console.log(`defects the state sweep found and the context sweep cannot (${grouped.size})\n───────`);
    for (const found of grouped.values()) {
      console.log(`${found.page} · state ${found.state} · ${found.check}`);
      console.log(`    ${found.subject}`);
      console.log(`      ${found.detail}`);
      console.log(`      contexts: ${found.contexts.join(', ')}`);
    }
    console.log('');

    // WHICH states paid for themselves, because that is a separate question
    // from whether any did. The stated hypothesis was that empty and error
    // states are where UI rots, and a run that finds everything in one state
    // refutes the general claim while confirming a narrower one.
    const perState = new Map();
    for (const found of grouped.values()) {
      perState.set(found.state, (perState.get(found.state) ?? 0) + 1);
    }
    const swept = new Set(cells.filter((cell) => !cell.control).map((cell) => cell.state));
    console.log('per state\n─────────');
    for (const stateId of swept) {
      console.log(`  ${stateId.padEnd(10)} ${perState.get(stateId) ?? 0} distinct defect(s)`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`page errors (${errors.length})\n───────────`);
    for (const error of errors.slice(0, 20)) console.log(`    ${error}`);
    console.log('');
  }

  const stateCells = cells.filter((cell) => !cell.control).length;
  const vacuous = doorsTotal === 0;
  console.log(
    `${cells.length} cells (${stateCells} state, ${cells.length - stateCells} control) in ${seconds}s · ` +
      `${doorsTotal} overflow doors opened · ${incompleteTotal} incomplete findings` +
      (state.reloads > 0 ? ` · ${state.reloads} dev-server reloads recovered from` : ''),
  );
  if (vacuous) {
    console.log(
      'VACUOUS — not one overflow trigger was revealed in any cell, so the open-overlay half of every check proved nothing.',
    );
  }
  console.log(
    grouped.size === 0
      ? 'RESULT — 0 defects found by state enumeration that the context sweep does not already find. The charter item is dead.'
      : `RESULT — ${grouped.size} distinct defect(s) across ${stateFound.length} witness cell(s), each silent on the ready state in the same context.`,
  );
  // Exit code is about the RUN, not about the answer: zero state-found defects
  // is a legitimate scientific result and must not read as a broken script.
  // Only a page error, a vacuous overlay half, or a control-state offender the
  // matrix should already have caught makes this run untrustworthy.
  const trustworthy = errors.length === 0 && !vacuous;
  console.log(trustworthy ? 'RUN OK' : 'RUN UNTRUSTWORTHY');
  return trustworthy ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   The self-test — the guard on the guard
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Three questions, and the sweep is decoration unless all three answer yes.
 *
 *  1. Does a declared state actually change what is rendered? A sweep over
 *     states that all render identically is a sweep over one state with extra
 *     rows in the table. This is the analogue of the values guard printing how
 *     many literals it still matches.
 *  2. Is the rule set actually reaching the canvas? Settings carries the escape
 *     hatch, so exactly one N601 must arrive there. Zero would mean the check
 *     ran over nothing — the false-PASS shape that has bitten this repository
 *     three times.
 *  3. Can the sweep FAIL, in a state, on something the happy path cannot even
 *     express? The injection target is `[role="alert"]`, which exists ONLY in
 *     the error state. So the row proves two things at once: the defect is
 *     caught where it is, and the happy path has no such element to break.
 */
async function runSelfTest(options) {
  const { browser, page, errors } = await openHarness(options);
  const state = { reloads: 0 };
  const rows = [];
  let broken = 0;

  console.log(`c11 state sweep — self-test against ${options.url}\n`);

  try {
    const declared = await readDeclaration(page, state);
    const baseline = CONTEXTS[0].context;

    /* ── 1. every declared state renders something of its own ─────────── */
    for (const { page: id, states } of declared) {
      const signatures = new Map();
      for (const stateId of states) {
        const audit = await resilient(page, state, async () => {
          await applyContext(page, { page: id, state: stateId, ...baseline });
          return page.evaluate(auditInPage);
        });
        if (audit.fatal) throw new Error(audit.fatal);
        signatures.set(stateId, audit.signature);
      }
      const duplicates = [];
      for (const [a, signature] of signatures) {
        for (const [b, other] of signatures) {
          if (a < b && signature === other) duplicates.push(`${a} === ${b} (${signature})`);
        }
      }
      const ok = duplicates.length === 0;
      if (!ok) broken += 1;
      rows.push({
        name: `${id}: states distinct`,
        verdict: ok ? 'CAUGHT' : 'VACUOUS',
        note: ok
          ? `${signatures.size} declared states, ${signatures.size} distinct renderings: ${[...signatures.values()].join(' ')}`
          : `states render identically, so sweeping them proves nothing — ${duplicates.join('; ')}`,
      });
    }

    /* ── 2. the rule set reaches the canvas ───────────────────────────── */
    const settings = await resilient(page, state, async () => {
      await applyContext(page, { page: 'settings', state: CONTROL_STATE, ...baseline });
      return page.evaluate(auditInPage);
    });
    const escapes = settings.findings.filter((finding) => finding.code === 'N601').length;
    const reaching = escapes === settings.escapes && settings.escapes > 0;
    if (!reaching) broken += 1;
    rows.push({
      name: 'rule set reaching',
      verdict: reaching ? 'CAUGHT' : 'BLIND',
      note: `${escapes} N601 warning(s) for ${settings.escapes} [data-escaped] subtree(s) on settings`,
    });

    /* ── 3. a defect in a state, invisible to the happy path ──────────── */
    // `[role="alert"]` is the error panel's live region and exists in no other
    // state, so an illegal `data-layout` on it is a defect the ready corpus
    // cannot even host. N610 is the rule that must notice.
    const inject = () => {
      const el = document.getElementById('canvas')?.querySelector('[role="alert"]');
      if (!el) return 'no [role="alert"] in this state';
      el.setAttribute('data-sweep-was-layout', el.getAttribute('data-layout') ?? '');
      el.setAttribute('data-layout', 'flexbox');
      return true;
    };
    const undo = () => {
      for (const el of document.querySelectorAll('[data-sweep-was-layout]')) {
        const original = el.getAttribute('data-sweep-was-layout') ?? '';
        if (original) el.setAttribute('data-layout', original);
        else el.removeAttribute('data-layout');
        el.removeAttribute('data-sweep-was-layout');
      }
    };

    const attempt = await resilient(page, state, async () => {
      await applyContext(page, { page: 'inbox', state: 'error', ...baseline });
      const clean = classify(await page.evaluate(auditInPage));
      const applied = await page.evaluate(inject);
      if (applied !== true) return { applied };
      const dirty = classify(await page.evaluate(auditInPage));
      await page.evaluate(undo);
      await page.evaluate(() => window.__c11.settled());
      const restored = classify(await page.evaluate(auditInPage));
      return { applied, clean, dirty, restored };
    });

    if (attempt.applied !== true) {
      broken += 1;
      rows.push({ name: 'error state breakable', verdict: 'INCONCLUSIVE', note: String(attempt.applied) });
    } else if (attempt.clean.check.length > 0) {
      broken += 1;
      rows.push({
        name: 'error state breakable',
        verdict: 'INCONCLUSIVE',
        note: `already reporting ${attempt.clean.check.length} offender(s) before the injection`,
      });
    } else if (attempt.dirty.check.length === 0) {
      broken += 1;
      rows.push({
        name: 'error state breakable',
        verdict: 'BLIND',
        note: 'an illegal data-layout on the error panel produced no finding',
      });
    } else if (attempt.restored.check.length > 0) {
      broken += 1;
      rows.push({
        name: 'error state breakable',
        verdict: 'STICKY',
        note: 'still reporting after the injection was removed',
      });
    } else {
      rows.push({
        name: 'error state breakable',
        verdict: 'CAUGHT',
        note: `${attempt.dirty.check.length} offender(s), first: ${attempt.dirty.check[0].subject}`,
      });
    }

    /* ── 3b. the happy path cannot host that defect at all ────────────── */
    const onReady = await resilient(page, state, async () => {
      await applyContext(page, { page: 'inbox', state: CONTROL_STATE, ...baseline });
      return page.evaluate(inject);
    });
    const stateSpecific = onReady !== true;
    if (!stateSpecific) {
      broken += 1;
      await page.evaluate(undo);
    }
    rows.push({
      name: 'happy path silent',
      verdict: stateSpecific ? 'CAUGHT' : 'BLIND',
      note: stateSpecific
        ? `the injected defect has no target on the ready state (${String(onReady)}), so the context matrix could never have found it`
        : 'the injection target exists on the ready state too, so this row proves nothing about state enumeration',
    });
  } finally {
    await browser.close();
  }

  const widths = [26, 13, 110];
  printRow(['assertion', 'verdict', 'evidence'], widths);
  printRow(['─────────', '───────', '────────'], widths);
  for (const row of rows) printRow([row.name, row.verdict, row.note], widths);

  console.log('');
  if (errors.length > 0) {
    for (const error of errors.slice(0, 10)) console.log(`page error: ${error}`);
    console.log('');
  }
  console.log(
    (broken === 0
      ? `PASS — all ${rows.length} self-checks hold. The state sweep renders distinct states, reaches them with the rule set, and fails on a defect the happy path cannot host.`
      : `FAIL — ${broken}/${rows.length} self-checks could not be shown to hold.`) +
      (state.reloads > 0 ? ` (${state.reloads} dev-server reloads recovered from)` : ''),
  );
  return broken === 0 && errors.length === 0 ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════ */

const options = parseArgs(process.argv.slice(2));
process.exitCode = options.selfTest ? await runSelfTest(options) : await runSweep(options);
