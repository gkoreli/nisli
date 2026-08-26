/**
 * Built-site proof for the FIRST item under `@nisli/intent`'s own Limits:
 * **"No SSG pre-solve. The static tier *should* resolve at build time; it is
 * untested."** (packages/intent/README.md:161.)
 *
 * `packages/www` is the only place in this repository that renders through the
 * real `@nisli/ssg`, so it is the only place the question can be answered. The
 * prototype recorded the stakes rather than the answer: the flash of unfit is
 * **zero composited frames** client-rendered, but **9-10 frames / 69-87ms** on
 * a 100ms hydration budget (experiments/c11-appearance/README.md:283).
 *
 * Three questions, each answered with numbers:
 *
 *   Q1  Is the STATIC tier already correct at first paint, with **no
 *       JavaScript**? Intent's static tier is pure CSS — custom properties plus
 *       container queries — so the honest test is a page with script execution
 *       disabled. Read out of band through CDP's `DOM`/`CSS` domains, which
 *       resolve style in the renderer WITHOUT running script, and checked
 *       against the closed form of the axis table rather than against itself.
 *
 *   Q2  What is the flash of unfit on the real SSG path? Measured with TWO
 *       instruments that disagree on purpose:
 *         naive     — a rAF loop snapshotting geometry at callback entry.
 *                     Over-reports: a rAF entry precedes paint, fires before
 *                     first contentful paint at all, and forces synchronous
 *                     layout every frame (it perturbs its own subject).
 *         composited — CDP `Page.screencastFrame`, i.e. the compositor's own
 *                     output, region-decoded and diffed against the settled
 *                     reference. A frame here is a frame that PAINTED.
 *       Both are printed. The composited pair is the one trusted, and the gap
 *       between them is reported rather than hidden.
 *
 *   Q3  Is CLS a usable oracle? The prototype measured that it is not, in both
 *       directions: 0 for a 46-frame 313px defect, and 0.1438 where nothing was
 *       ever painted wrong. Verified here against the two trusted instruments,
 *       with the silent-zero trap closed: an unregistered `layout-shift`
 *       observer reports exactly the same 0 as a clean page, so the proof
 *       asserts the observer is live and demonstrably capable of a nonzero
 *       reading before it believes a 0.
 *
 * And the payload, because "does not work" is only half an answer: the proof
 * SIMULATES SSG pre-solve. It captures the attributes the engine wrote at
 * settle, rewrites those bytes into the served HTML so they are present at
 * first paint, and re-measures. Matched to the viewport it was captured at, and
 * CROSSED against another, because the SSG emits one HTML for every viewport
 * and that is the question a per-viewport solve cannot dodge.
 *
 *   node scripts/intent-ssg-proof.mjs                 # the built site
 *   node scripts/intent-ssg-proof.mjs --fixture       # self-contained subject
 *   node scripts/intent-ssg-proof.mjs --self-test     # every assertion, failing
 *   node scripts/intent-ssg-proof.mjs --calibrate     # instrument vs known defect
 *
 * Preconditions for the built-site run: `pnpm --filter @nisli/www build`, so
 * that dist/ carries the SSG HTML, dist/assets/site.css and
 * dist/ui-preview/hydrate.js. The proof NEVER substitutes its own assets for
 * missing ones — a proof that quietly builds its own subject is measuring
 * something else, which is this repository's most expensive recorded defect
 * ("a correct measurement of the wrong thing"). It fails and names the command.
 */
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(wwwDir, '..', '..');
const distDir = join(wwwDir, 'dist');
const intentDir = join(repoRoot, 'packages', 'intent');

// ── The subject's own vocabulary, agreed with IntentSurfaces ────────────────
// Every selector below addresses an attribute that either the theme table or
// `src/fit/dom.ts` produces. Nothing here is a class name and nothing here is a
// width: if a selector ever needed one, that would be a finding about the
// vocabulary, not a licence.
const ISLAND = '[data-hydrate="intent"][data-intent]';
const CONTAINER = '[data-hydrate="intent"] [data-fit]';
const CANDIDATE = '[data-fit] [data-collapse]';
/** What `domMutator.apply` writes (packages/intent/src/fit/dom.ts:26). */
const STRATEGY_ATTRS = ['data-truncate', 'data-hidden', 'data-collapsed'];
/** What `domMutator.markFit` writes; the settle predicate (dom.ts:220). */
const FIT_STATES = ['settled', 'unsatisfiable'];

/** House widths (message-layout-proof.mjs), plus two column-pressure points. */
const WIDTHS = [1280, 900, 640, 390];
const VIEWPORT_HEIGHT = 900;

/** Routes under test. Confirmed with IntentSurfaces and WireIntent. */
const ROUTES = ['/intent/comparison/', '/intent/playground/', '/intent/'];

/** Sub-pixel drift is rounding; a wrong derived value is not. */
const CSS_EPSILON = 0.05;
/** Per-channel difference below which two pixels are the same colour. */
const CHANNEL_EPSILON = 8;
/** `clientWidth`/`scrollWidth` are rounded integers — same tolerance as dom.ts:23. */
const OVERFLOW_TOLERANCE = 1;
/** Quiescence: no delivered frame and no geometry change for this long. */
const SETTLE_QUIET_MS = 400;

// ══════════════════════════════════════════════════════════════════════════
// THE AXIS TABLE, AS ARITHMETIC
// ══════════════════════════════════════════════════════════════════════════
// These are the axis INPUTS from packages/intent/theme/tokens.css, not the
// outputs. The check below derives control height, padding, type scale and
// colour from them and compares against what Chromium resolved, so it can catch
// both "the static tier did not resolve at all" and "it resolved to the wrong
// number". Asserting `--unit` directly is impossible and that is not a defect:
// a custom property's computed value is the *unsubstituted token stream*, so
// `getComputedStyle` reports `calc(3px * 1)` — measured, see the note in
// tokens.css:95. Only real properties are checkable, which is exactly the four
// the question asks about.
const DENSITY = {
  comfortable: { unitBase: 4, text: 14, meta: 12, title: 15, display: 30 },
  compact: { unitBase: 3, text: 13, meta: 11, title: 14, display: 26 },
  dense: { unitBase: 2, text: 12, meta: 11, title: 12, display: 22 },
};
const INPUT = {
  pointer: { unitScale: 1, textScale: 1, minTarget: 0 },
  touch: { unitScale: 1.25, textScale: 1.08, minTarget: 44 },
};
const THEME = {
  light: { s1: '#ffffff', s2: '#f6f6f7', s3: '#ececee', fg: '#111114', fgMuted: '#5f5f68', accent: '#111114', accentFg: '#ffffff', link: '#1a4fb4' },
  dark: { s1: '#16161a', s2: '#1d1d22', s3: '#26262c', fg: '#f4f4f5', fgMuted: '#a0a0ab', accent: '#f4f4f5', accentFg: '#16161a', link: '#8ab4ff' },
};
/** The one asserted floor that bounds the type ramp (tokens.css:53). */
const MIN_TEXT = 11;

/** Every context the axes can spell. Three orthogonal axes, so the product. */
const CONTEXTS = Object.keys(DENSITY).flatMap((density) =>
  Object.keys(INPUT).flatMap((input) => Object.keys(THEME).map((theme) => ({ density, input, theme }))),
);

/** The closed form: one unit, and every value is a function of it. */
function derive({ density, input, theme }) {
  const d = DENSITY[density];
  const i = INPUT[input];
  const unit = d.unitBase * i.unitScale;
  const ramp = (base) => base * i.textScale;
  return {
    unit,
    controlHeight: Math.max(unit * 9, i.minTarget),
    controlPadInline: unit * 4,
    surfacePad: unit * 4,
    text: { display: ramp(d.display), title: ramp(d.title), body: ramp(d.text), meta: Math.max(ramp(d.meta), MIN_TEXT), label: Math.max(ramp(d.meta), MIN_TEXT) },
    colour: THEME[theme],
  };
}

// ══════════════════════════════════════════════════════════════════════════
// RESOURCE OWNERSHIP
// ══════════════════════════════════════════════════════════════════════════
// Same precedence contract as message-layout-proof.mjs: a cleanup failure
// never masks the primary failure, and every resource is attempted even after
// an earlier one throws.
function closeServer(server) {
  return new Promise((resolve, reject) => {
    let invocationError;
    let callbackError;
    let callbackRan = false;
    let connectionError;
    let connectionAttemptRan = false;
    const settle = () => {
      if (!connectionAttemptRan || (!invocationError && !callbackRan)) return;
      const failure = invocationError ?? callbackError ?? connectionError;
      if (failure) reject(failure);
      else resolve();
    };
    try {
      server.close((error) => {
        callbackRan = true;
        callbackError = error;
        settle();
      });
    } catch (error) {
      invocationError = error;
    }
    try {
      server.closeAllConnections?.();
    } catch (error) {
      connectionError = error;
    }
    connectionAttemptRan = true;
    settle();
  });
}

async function cleanupResources({ browser, server, primary }) {
  const failures = [];
  for (const close of [() => browser?.close(), () => server && closeServer(server)]) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (!primary && failures.length) throw failures[0];
}

// ══════════════════════════════════════════════════════════════════════════
// THE SERVER
// ══════════════════════════════════════════════════════════════════════════
const CONTENT_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/**
 * Serves a document root verbatim, plus two mount points the self-contained
 * fixture needs: the REAL theme table straight out of the package (so the
 * fixture's static tier is the shipped table, not a copy of it), and the
 * in-memory bundle of the real `fit()`.
 *
 * `root` is a STAGED COPY of dist/, never dist/ itself — see `stageDist`.
 */
function startServer({ routes = new Map(), root = distDir } = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      const synthetic = routes.get(pathname);
      if (synthetic) {
        response.setHeader('content-type', synthetic.type);
        response.end(synthetic.body);
        return;
      }
      if (pathname.startsWith('/intent-theme/')) {
        const name = normalize(join(intentDir, 'theme', pathname.slice('/intent-theme/'.length)));
        if (!name.startsWith(join(intentDir, 'theme'))) throw new Error('invalid path');
        response.setHeader('content-type', 'text/css');
        createReadStream(name).on('error', () => response.writeHead(404).end()).pipe(response);
        return;
      }
      let file = normalize(join(root, pathname.replace(/^\/+/, '')));
      if (!file.startsWith(root)) throw new Error('invalid path');
      const info = await stat(file).catch(() => undefined);
      if (!info || info.isDirectory()) file = join(file, 'index.html');
      response.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
      createReadStream(file)
        .on('error', () => {
          if (!response.headersSent) response.writeHead(404);
          response.end();
        })
        .pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('intent-ssg proof server has no TCP address'));
        return;
      }
      resolve({ server, base: `http://127.0.0.1:${address.port}` });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Q1 — THE STATIC TIER, WITH SCRIPT EXECUTION DISABLED
// ══════════════════════════════════════════════════════════════════════════
// The instrument matters as much as the result. Playwright's
// `javaScriptEnabled: false` sets `Emulation.setScriptExecutionDisabled`, which
// stops the PAGE's scripts — measured: an inline `<script>` writing an
// attribute to <html> does not run. It does NOT stop Playwright's own utility
// world, so `page.evaluate` still works and "evaluate threw" is NOT evidence
// that scripting is off. So the reading is taken through CDP's `DOM` and `CSS`
// domains, which resolve style in the renderer with no script involved at all,
// and the absence of script is proven positively instead: the engine's own
// `data-fit` state and `data-collapsed-count` must be absent.

/** Chromium reports colours as `rgb(a, b, c)`; the table spells them in hex. */
function normaliseColour(value) {
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value.trim());
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')}`;
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return hex ? `#${hex[1].toLowerCase()}` : value.trim();
}

const px = (value) => Number.parseFloat(value);

/** Flatten CDP's node tree into `{ nodeId, name, attrs, parent }`, once. */
function flattenTree(root) {
  const nodes = new Map();
  const walk = (node, parent) => {
    const attrs = {};
    for (let i = 0; i < (node.attributes?.length ?? 0); i += 2) attrs[node.attributes[i]] = node.attributes[i + 1];
    nodes.set(node.nodeId, { nodeId: node.nodeId, name: node.nodeName, attrs, parent });
    for (const child of node.children ?? []) walk(child, node.nodeId);
    if (node.contentDocument) walk(node.contentDocument, node.nodeId);
  };
  walk(root, undefined);
  return nodes;
}

/** Nearest declared value of an axis attribute, walking up the flattened tree. */
function resolveAxis(nodes, nodeId, attribute, allowed) {
  for (let id = nodeId; id !== undefined; id = nodes.get(id)?.parent) {
    const value = nodes.get(id)?.attrs?.[attribute];
    if (value && allowed.includes(value)) return value;
  }
  return undefined;
}

/**
 * Read every intent-declared element on one page in one context, with the
 * page's own scripts disabled. Returns the raw readings; the assertions live in
 * `checkStaticTier` so that `--self-test` can perturb one without the other.
 */
async function measureStaticTier({ browser, base, route, context, block = [] }) {
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
  });
  try {
    const page = await ctx.newPage();
    for (const pattern of block) await page.route(pattern, (route_) => route_.abort());
    // The axes are attributes and they inherit, so a context is applied by
    // rewriting the ROOT element of the same built bytes. This is the axes'
    // documented usage (tokens.css:8) and it is the only way to reach more than
    // one context with scripting off, since nothing can set an attribute later.
    if (context) {
      await page.route(`**${route}`, async (route_) => {
        const response = await route_.fetch();
        const body = (await response.text()).replace(
          /<html([^>]*)>/i,
          (_all, rest) =>
            `<html${rest.replace(/\s+data-(?:density|input|theme)="[^"]*"/g, '')}` +
            ` data-density="${context.density}" data-input="${context.input}" data-theme="${context.theme}">`,
        );
        await route_.fulfill({ response, body });
      });
    }
    const failed = [];
    page.on('requestfailed', (request) => failed.push(request.url()));
    await page.goto(`${base}${route}`, { waitUntil: 'load' });

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const nodes = flattenTree(root);

    const selector = [
      '[data-appearance="action"]',
      '[data-appearance="surface"]',
      '[data-appearance="avatar"]',
      '[data-appearance="field"]',
      '[data-text]',
    ].join(',');
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });

    const readings = [];
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId);
      if (!node) continue;
      const { computedStyle } = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
      const style = Object.fromEntries(computedStyle.map((p) => [p.name, p.value]));
      const height = px(style['block-size'] ?? style.height ?? 'NaN');
      // WHETHER THE ELEMENT HAS A LAYOUT BOX AT ALL, asked of the renderer
      // rather than inferred from `display`.
      //
      // MEASURED: `[data-overflow]` triggers are hidden by states.css until the
      // engine writes `data-shown`, so with scripting disabled they resolve
      // `block-size: auto` and every geometric closed form reads NaN. Their own
      // `display` is `inline-flex` — the hidden ancestor is what removes the box
      // — so a `display === 'none'` guard skips nothing and the proof reports 132
      // failures about the table working exactly as designed.
      //
      // `DOM.getBoxModel` fails precisely when there is no box, which is the
      // distinction wanted. It is only asked when a geometric reading is already
      // non-finite, so the cost is one extra round trip for the handful of
      // elements that need it — and a non-finite reading on an element that DOES
      // have a box still fails, which is what keeps the skip from becoming a
      // silent excuse.
      let boxed = true;
      if (!Number.isFinite(height)) {
        boxed = await cdp
          .send('DOM.getBoxModel', { nodeId })
          .then(() => true)
          .catch(() => false);
      }
      readings.push({
        appearance: node.attrs['data-appearance'],
        role: node.attrs['data-role'],
        text: node.attrs['data-text'],
        // Effective context, resolved per element rather than assumed: a dense
        // panel inside a comfortable page is the axes working, not a mismatch.
        context: {
          density: resolveAxis(nodes, nodeId, 'data-density', Object.keys(DENSITY)) ?? context?.density,
          input: resolveAxis(nodes, nodeId, 'data-input', Object.keys(INPUT)) ?? context?.input,
          theme: resolveAxis(nodes, nodeId, 'data-theme', Object.keys(THEME)) ?? context?.theme,
        },
        display: (style.display ?? '').trim(),
        boxed,
        height,
        padLeft: px(style['padding-left'] ?? 'NaN'),
        fontSize: px(style['font-size'] ?? 'NaN'),
        colour: normaliseColour(style.color ?? ''),
        background: normaliseColour(style['background-color'] ?? ''),
      });
    }

    // Positive evidence that the page's own scripts never ran: the engine's
    // state attributes are what a hydrated page carries, and nothing else
    // writes them.
    const { nodeIds: solved } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: FIT_STATES.map((s) => `[data-fit="${s}"]`).concat('[data-collapsed-count]', STRATEGY_ATTRS.map((a) => `[${a}]`)).join(','),
    });
    const { nodeIds: declared } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-fit]' });

    return { route, context, readings, solvedCount: solved.length, declaredContainers: declared.length, failedRequests: failed };
  } finally {
    await ctx.close();
  }
}

/**
 * The assertions for Q1. Every reading must match the closed form derived from
 * the axis inputs — not from the stylesheet, which would make the check a
 * restatement of its subject.
 */
function checkStaticTier(records, failures, { minReadings }) {
  let checked = 0;
  let unrendered = 0;
  for (const record of records) {
    if (record.solvedCount !== 0) {
      failures.push(
        new Error(
          `static-no-js-solve: ${record.route} carried ${record.solvedCount} engine-written state attribute(s) with script execution disabled — ` +
            'so the static-tier reading is not a reading of the static tier alone',
        ),
      );
    }
    for (const r of record.readings) {
      if (!r.context.density || !r.context.input || !r.context.theme) {
        failures.push(new Error(`static-derived: ${record.route} has an element in an incomplete context ${JSON.stringify(r.context)}`));
        continue;
      }
      // No box, no derived geometry. An overflow trigger the table keeps hidden
      // until the engine reveals it is the table WORKING, and asserting a
      // control height against an element with no layout box would report the
      // table's own correct decision as a defect.
      if (r.boxed === false || r.display === 'none' || r.display === 'contents' || r.display === '') {
        unrendered += 1;
        continue;
      }
      const want = derive(r.context);
      const label = `${record.route} ${r.context.density}/${r.context.input}/${r.context.theme} ${r.appearance ?? `text=${r.text}`}${r.role ? `[${r.role}]` : ''}`;
      const near = (got, expected) => Number.isFinite(got) && Math.abs(got - expected) <= CSS_EPSILON;

      if (r.appearance === 'action') {
        checked += 1;
        if (!near(r.height, want.controlHeight)) {
          failures.push(new Error(`static-derived: ${label} control height ${r.height}px, closed form ${want.controlHeight}px (unit ${want.unit}px x 9, floor ${INPUT[r.context.input].minTarget}px)`));
        }
        if (r.role !== 'link' && !near(r.padLeft, want.controlPadInline)) {
          failures.push(new Error(`static-derived: ${label} padding-inline ${r.padLeft}px, closed form ${want.controlPadInline}px (unit ${want.unit}px x 4)`));
        }
        if (!near(r.fontSize, want.text.body)) {
          failures.push(new Error(`static-derived: ${label} font-size ${r.fontSize}px, closed form ${want.text.body}px`));
        }
        const wantPaint =
          r.role === 'primary' ? { colour: want.colour.accentFg, background: want.colour.accent }
          : r.role === 'quiet' || r.role === 'link' ? undefined
          : { colour: want.colour.fg, background: want.colour.s1 };
        if (wantPaint && (r.colour !== wantPaint.colour || r.background !== wantPaint.background)) {
          failures.push(new Error(`static-derived: ${label} painted ${r.colour} on ${r.background}, table says ${wantPaint.colour} on ${wantPaint.background}`));
        }
      } else if (r.text && want.text[r.text] !== undefined) {
        checked += 1;
        if (!near(r.fontSize, want.text[r.text])) {
          failures.push(new Error(`static-derived: ${label} font-size ${r.fontSize}px, closed form ${want.text[r.text]}px`));
        }
        const expected = r.text === 'meta' || r.text === 'label' ? want.colour.fgMuted : want.colour.fg;
        if (r.colour !== expected) {
          failures.push(new Error(`static-derived: ${label} colour ${r.colour}, table says ${expected}`));
        }
      }
    }
  }
  // Non-vacuity: a check that silently stops matching reports a clean page, and
  // every gate agrees. That is N700, the defect this whole package documents.
  if (checked < minReadings) {
    failures.push(new Error(`static-derived: VACUOUS — only ${checked} derived value(s) checked, floor is ${minReadings}. The selector matched nothing worth reading.`));
  }
  return { checked, unrendered };
}

// ══════════════════════════════════════════════════════════════════════════
// Q2/Q3 — THE FLASH OF UNFIT
// ══════════════════════════════════════════════════════════════════════════

/**
 * Page-side instrument, installed before any page script. It records four
 * independent streams, and it records the *provenance* of each so a zero can be
 * told apart from an absence:
 *   - paint timing         (`first-contentful-paint`)
 *   - resource timing      (hydrate entry + its code-split chunks: the round
 *                           trip WireIntent asked be named separately rather
 *                           than folded into "hydration")
 *   - attribute mutations  (the engine writing `data-fit`)
 *   - a rAF geometry loop  (the NAIVE instrument, kept so its over-report is
 *                           measurable rather than asserted)
 */
function instrumentSource({ container, candidate, sample }) {
  return `(() => {
  const P = (window.__intentProbe = {
    fcp: null, raf: [], mutations: [], shifts: [],
    clsSupported: false, clsRegistered: false, clsError: null,
    mutationsRegistered: false, mutationError: null,
    resources: [], sampling: ${sample ? 'true' : 'false'},
    origin: performance.timeOrigin, stopped: false,
  });
  const CONTAINER = ${JSON.stringify(container)};
  const CANDIDATE = ${JSON.stringify(candidate)};

  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === 'first-contentful-paint' && P.fcp === null) P.fcp = e.startTime;
    }).observe({ type: 'paint', buffered: true });
  } catch (error) { P.paintError = String(error); }

  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!/\\/ui-preview\\//.test(e.name)) continue;
        P.resources.push({ name: e.name.replace(/^https?:\\/\\/[^/]+/, ''), start: e.startTime, end: e.responseEnd });
      }
    }).observe({ type: 'resource', buffered: true });
  } catch (error) { P.resourceError = String(error); }

  // The silent-zero trap. An unregistered layout-shift observer produces the
  // same 0 as a clean page, so both facts are recorded: whether the entry type
  // exists, and whether observe() actually took.
  try {
    P.clsSupported = (PerformanceObserver.supportedEntryTypes || []).includes('layout-shift');
    const o = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) P.shifts.push({ value: e.value, t: e.startTime });
    });
    o.observe({ type: 'layout-shift', buffered: true });
    P.clsRegistered = true;
  } catch (error) { P.clsError = String(error); }

  const snap = () => {
    const containers = [...document.querySelectorAll(CONTAINER)];
    const candidates = [...document.querySelectorAll(CANDIDATE)];
    return {
      now: performance.now(),
      // scrollWidth/clientWidth force synchronous layout. That is the naive
      // instrument perturbing its own subject, and the quiet pass exists to
      // measure how much.
      c: containers.map((n) => {
        const r = n.getBoundingClientRect();
        return { fit: n.getAttribute('data-fit'), cc: n.getAttribute('data-collapsed-count'),
                 over: n.scrollWidth - n.clientWidth, x: r.x, y: r.y, w: r.width, h: r.height };
      }),
      k: candidates.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height,
                 s: ${JSON.stringify(STRATEGY_ATTRS)}.filter((a) => n.hasAttribute(a)).join('+') };
      }),
      // The mutator's fourth output, and the one a pre-solve recipe forgets.
      // revealOverflow toggles data-shown on the overflow triggers a container
      // owns (packages/intent/src/fit/dom.ts:225); it is not a container state
      // and not a candidate strategy, so a recipe built from those two alone
      // reproduces the solve INCOMPLETELY. Measured: 20.56px of residual
      // displacement on an otherwise fully pre-solved page.
      o: [...document.querySelectorAll(CONTAINER + ' [data-overflow]')].map((n) => n.hasAttribute('data-shown')),
    };
  };
  P.snap = snap;

  if (P.sampling) {
    const tick = () => {
      if (P.stopped) return;
      P.raf.push(snap());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // The engine writes data-fit and data-collapsed-count; nothing else does.
  //
  // MEASURED: this instrument first shipped observing \`document.documentElement\`
  // and recorded ZERO mutations against a fixture that provably writes them —
  // an init script runs before the parser has created <html>, so the target was
  // null and the stream was lost in silence while every other stream kept
  // reporting. Observing \`document\` cannot be null, and the registration is now
  // recorded so a lost stream is loud instead of reading as "nothing happened".
  try {
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type !== 'attributes') continue;
        P.mutations.push({
          now: performance.now(), attr: r.attributeName,
          from: r.oldValue, to: r.target.getAttribute(r.attributeName),
          tag: r.target.tagName.toLowerCase(),
        });
      }
    }).observe(document, {
      attributes: true, subtree: true, attributeOldValue: true,
      attributeFilter: ['data-fit', 'data-collapsed-count', ...${JSON.stringify(STRATEGY_ATTRS)}],
    });
    P.mutationsRegistered = true;
  } catch (error) { P.mutationError = String(error); }
})();`;
}

/** Decoder page: PNG -> region ImageData, kept off the measured page. */
async function openDecoder(browser) {
  const ctx = await browser.newContext({ viewport: { width: 64, height: 64 } });
  const page = await ctx.newPage();
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.__decodeRegion = async (b64, region) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const x = Math.max(0, Math.min(region.x, bitmap.width - 1));
      const y = Math.max(0, Math.min(region.y, bitmap.height - 1));
      const w = Math.max(1, Math.min(region.w, bitmap.width - x));
      const h = Math.max(1, Math.min(region.h, bitmap.height - y));
      const canvas = new OffscreenCanvas(w, h);
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(bitmap, -x, -y);
      bitmap.close();
      const data = g.getImageData(0, 0, w, h).data;
      // Return a compact base64 payload rather than a 4-million-element array:
      // the protocol round trip is the bottleneck, not the decode.
      let binary = '';
      for (let i = 0; i < data.length; i += 1) binary += String.fromCharCode(data[i]);
      return { w, h, rgba: btoa(binary) };
    };
  });
  return {
    page,
    async decode(b64, region) {
      const { w, h, rgba } = await page.evaluate(([b, r]) => window.__decodeRegion(b, r), [b64, region]);
      return { w, h, data: Buffer.from(rgba, 'base64') };
    },
    close: () => ctx.close(),
  };
}

/**
 * Per-frame comparison against the settled reference, inside the region — plus
 * whether the region is UNIFORM, which is how "this frame had not painted yet"
 * is decided.
 *
 * MEASURED, and the reason the clock is not used for that decision: the first
 * classification keyed "not yet painted" off `metadata.timestamp` versus the
 * page's `first-contentful-paint`, and the two clocks are only approximately
 * aligned — CDP timestamps come from the browser process, `performance.now()`
 * from the renderer's timeOrigin. A few milliseconds of skew moved the boundary
 * across the first painted frame and the instrument reported ZERO wrong frames
 * against a fixture with a known 240px defect. Uniformity is the compositor's
 * own evidence and needs no clock at all; timestamps are used only for
 * DIFFERENCES between frames, where the skew cancels.
 */
function diffRegion(frame, reference) {
  let lo = [255, 255, 255];
  let hi = [0, 0, 0];
  for (let p = 0; p < frame.data.length; p += 4) {
    for (let c = 0; c < 3; c += 1) {
      const v = frame.data[p + c];
      if (v < lo[c]) lo[c] = v;
      if (v > hi[c]) hi[c] = v;
    }
  }
  const uniform = hi.every((h, c) => h - lo[c] <= CHANNEL_EPSILON);
  if (frame.w !== reference.w || frame.h !== reference.h) {
    return { pixels: frame.w * frame.h, extentX: frame.w, extentY: frame.h, uniform, resized: true };
  }
  let pixels = 0;
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  for (let p = 0; p < frame.data.length; p += 4) {
    const d = Math.max(
      Math.abs(frame.data[p] - reference.data[p]),
      Math.abs(frame.data[p + 1] - reference.data[p + 1]),
      Math.abs(frame.data[p + 2] - reference.data[p + 2]),
    );
    if (d <= CHANNEL_EPSILON) continue;
    pixels += 1;
    const index = p / 4;
    const x = index % frame.w;
    const y = (index - x) / frame.w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { pixels, extentX: maxX < 0 ? 0 : maxX - minX + 1, extentY: maxY < 0 ? 0 : maxY - minY + 1, uniform, resized: false };
}

const median = (values) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};

/**
 * One page load, fully instrumented. `hooks` is where every counterfactual
 * enters: URL blocking, HTML rewriting (the pre-solve simulation), and the
 * deliberate mis-aiming of the pixel differ.
 */
async function measureFlash({ browser, decoder, base, route, width, height = VIEWPORT_HEIGHT, sample = true, hooks = {} }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    for (const pattern of hooks.block ?? []) await page.route(pattern, (r) => r.abort());
    let rewriteSites = 0;
    let rewriteContainers = 0;
    let rewriteContainersWanted = 0;
    if (hooks.rewriteHtml) {
      await page.route(`**${route}`, async (r) => {
        const response = await r.fetch();
        const original = await response.text();
        const { body, sites, containerSites = 0, containersWanted = 0 } = hooks.rewriteHtml(original);
        rewriteSites = sites;
        rewriteContainers = containerSites;
        rewriteContainersWanted = containersWanted;
        await r.fulfill({ response, body });
      });
    }
    // Counterfactual patches go in FIRST: init scripts run in registration
    // order, so a patch registered after the instrument cannot affect the
    // observers the instrument has already installed. Measured — the
    // cls-observable lever silently did nothing in that order, and the
    // self-test reported the assertion as vacuous.
    if (hooks.initScript) await page.addInitScript(hooks.initScript);
    await page.addInitScript(instrumentSource({ container: CONTAINER, candidate: CANDIDATE, sample }));

    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', (event) => {
      frames.push({ data: event.data, epochMs: event.metadata.timestamp * 1000 });
      cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });

    await page.goto(`${base}${route}`, { waitUntil: 'load' });
    // Quiescence, not a fixed sleep: wait until neither the compositor nor the
    // DOM has changed for SETTLE_QUIET_MS, so a slow chunk cannot be mistaken
    // for a settled page.
    let lastFrameCount = -1;
    let lastSignature = '';
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await page.waitForTimeout(SETTLE_QUIET_MS / 4);
      const signature = await page.evaluate(() => JSON.stringify(window.__intentProbe.snap().c));
      if (frames.length === lastFrameCount && signature === lastSignature) break;
      lastFrameCount = frames.length;
      lastSignature = signature;
    }
    await cdp.send('Page.stopScreencast');
    const probe = await page.evaluate(() => {
      window.__intentProbe.stopped = true;
      const p = window.__intentProbe;
      return {
        fcp: p.fcp, raf: p.raf, mutations: p.mutations, shifts: p.shifts,
        clsSupported: p.clsSupported, clsRegistered: p.clsRegistered, clsError: p.clsError,
        mutationsRegistered: p.mutationsRegistered, mutationError: p.mutationError,
        resources: p.resources, origin: p.origin, settled: p.snap(),
      };
    });

    // ── the composited stream ──────────────────────────────────────────────
    // metadata.timestamp is epoch seconds; performance.now() is relative to
    // timeOrigin. Both are converted to page-relative milliseconds so the two
    // instruments share one clock.
    const toPageMs = (epochMs) => epochMs - probe.origin;
    const region = hooks.region ? hooks.region({ width, height, settled: probe.settled }) : regionFor({ width, height, settled: probe.settled });

    const decoded = [];
    for (const frame of frames) decoded.push(await decoder.decode(frame.data, region));
    const reference = decoded.at(-1);
    const classified = frames.map((frame, i) => {
      const t = toPageMs(frame.epochMs);
      const diff = reference ? diffRegion(decoded[i], reference) : { pixels: 0, extentX: 0, extentY: 0, uniform: true };
      // A uniform region is a frame in which the subject had not painted. It is
      // never "wrong", because there was nothing on screen to be wrong. The
      // reference frame is uniform only on a subject that renders nothing at
      // all, and `instrument-live` refuses that case rather than passing it.
      return { i, t, ...diff, wrong: !diff.uniform && diff.pixels > 0 };
    });

    const firstPaint = classified.find((f) => !f.uniform);
    const firstWrong = classified.find((f) => f.wrong);
    const settledFrame = firstWrong ? classified.find((f) => f.i > firstWrong.i && !f.wrong && !f.uniform) : undefined;
    const rafIntervals = probe.raf.slice(1).map((s, i) => s.now - probe.raf[i].now).filter((d) => d > 1 && d < 100);
    const frameMs = median(rafIntervals);
    const compositedWrongMs = firstWrong ? (settledFrame ? settledFrame.t - firstWrong.t : NaN) : 0;

    // ── the naive stream ──────────────────────────────────────────────────
    // Everything here is measured RELATIVE TO THE SETTLED STATE, and that is a
    // correction rather than a nicety. The first version tested absolute
    // overflow, so a container the solver reports `unsatisfiable` — one that
    // still overflows AFTER spending every declared degradation — counted as
    // unfit in every frame including the settled ones. It reported 25 unfit
    // frames over 199.7ms on a page whose flash was 9 frames, and it reported a
    // 30px "defect" that was simply the page's permanent, correctly-reported
    // residual. A flash is a DIFFERENCE from the settled result; a persistent
    // overflow is a different finding with a different owner.
    const settledContainers = probe.settled.c;
    const settledCandidates = probe.settled.k;
    const settledOver = settledContainers.map((c) => c.over);
    const unfit = (sampleRow) =>
      sampleRow.c.some((c, i) => {
        const want = settledContainers[i];
        if (!want) return false;
        return (
          Math.abs(c.over - settledOver[i]) > OVERFLOW_TOLERANCE ||
          Math.abs(c.h - want.h) > OVERFLOW_TOLERANCE ||
          Math.abs(c.w - want.w) > OVERFLOW_TOLERANCE
        );
      }) ||
      sampleRow.k.some((k, i) => {
        const want = settledCandidates[i];
        return want ? Math.max(Math.abs(k.x - want.x), Math.abs(k.y - want.y), Math.abs(k.w - want.w), Math.abs(k.h - want.h)) > OVERFLOW_TOLERANCE : false;
      });
    const naiveAll = probe.raf.filter(unfit);
    const naiveAfterPaint = naiveAll.filter((s) => probe.fcp === null || s.now >= probe.fcp);

    let maxOverflow = 0;
    let transientOverflow = 0;
    let maxDisplacement = 0;
    for (const row of probe.raf) {
      row.c.forEach((c, i) => {
        maxOverflow = Math.max(maxOverflow, c.over);
        if (settledOver[i] !== undefined) transientOverflow = Math.max(transientOverflow, c.over - settledOver[i]);
      });
      row.k.forEach((k, i) => {
        const want = settledCandidates[i];
        if (!want) return;
        maxDisplacement = Math.max(maxDisplacement, Math.abs(k.x - want.x), Math.abs(k.y - want.y), Math.abs(k.w - want.w), Math.abs(k.h - want.h));
      });
    }

    const solveMutations = probe.mutations.filter((m) => m.attr === 'data-fit' && FIT_STATES.includes(m.to ?? ''));
    const hydrateResource = probe.resources.find((r) => /hydrate\.js$/.test(r.name));
    const chunkResources = probe.resources.filter((r) => /\/chunks\//.test(r.name));

    return {
      route, width, height, sample, mode: hooks.label ?? 'as-shipped', rewriteSites, rewriteContainers, rewriteContainersWanted,
      errors, failed: [],
      // provenance / non-vacuity
      containers: settledContainers.length,
      candidates: settledCandidates.length,
      rafSamples: probe.raf.length,
      framesDelivered: frames.length,
      regionPx: region,
      frameMs,
      // phases
      fcpMs: probe.fcp,
      // The compositor's own first-paint boundary, alongside the renderer's
      // reported FCP. The gap between them is the clock skew that made a
      // timestamp-based classification unsafe; it is printed rather than
      // corrected, because the number the proof relies on is a frame-to-frame
      // difference in which the skew cancels.
      firstCompositedPaintMs: firstPaint ? +firstPaint.t.toFixed(1) : null,
      blankFrames: classified.filter((f) => f.uniform).length,
      hydrateJs: hydrateResource ? { start: +hydrateResource.start.toFixed(1), end: +hydrateResource.end.toFixed(1) } : null,
      chunks: chunkResources.map((r) => ({ name: r.name, start: +r.start.toFixed(1), end: +r.end.toFixed(1) })),
      firstSolveMs: solveMutations.length ? +solveMutations[0].now.toFixed(1) : null,
      lastSolveMs: solveMutations.length ? +solveMutations.at(-1).now.toFixed(1) : null,
      solveMutations: solveMutations.length,
      // naive instrument
      naiveUnfitFrames: naiveAll.length,
      naiveUnfitFramesAfterPaint: naiveAfterPaint.length,
      naiveUnfitMs: naiveAll.length ? +(naiveAll.at(-1).now - naiveAll[0].now).toFixed(1) : 0,
      // composited instrument
      compositedWrongStates: classified.filter((f) => f.wrong).length,
      compositedWrongMs: Number.isFinite(compositedWrongMs) ? +compositedWrongMs.toFixed(1) : null,
      compositedWrongFrames:
        firstWrong && Number.isFinite(compositedWrongMs) && Number.isFinite(frameMs) ? Math.round(compositedWrongMs / frameMs) : firstWrong ? null : 0,
      worstVisibleExtentPx: Math.max(0, ...classified.filter((f) => f.wrong).map((f) => f.extentX)),
      worstVisibleRowsPx: Math.max(0, ...classified.filter((f) => f.wrong).map((f) => f.extentY)),
      worstVisiblePixels: Math.max(0, ...classified.filter((f) => f.wrong).map((f) => f.pixels)),
      // geometry — absolute for context, TRANSIENT for the verdict
      maxOverflowPx: +maxOverflow.toFixed(2),
      settledOverflowPx: +Math.max(0, ...settledOver, 0).toFixed(2),
      transientOverflowPx: +transientOverflow.toFixed(2),
      maxDisplacementPx: +maxDisplacement.toFixed(2),
      // settled state
      collapsedTotal: settledContainers.reduce((sum, c) => sum + (Number(c.cc) || 0), 0),
      fitStates: settledContainers.map((c) => c.fit),
      // Did the served bytes already carry a solved state at the FIRST sampled
      // frame, and did any container later REGRESS from solved to unsolved?
      // The second question is the one a replace-mount island makes real: bytes
      // pre-solved by the SSG are thrown away when the live half replaces the
      // static subtree, so "the attributes were in the HTML" and "the attributes
      // survived to the settled frame" are different claims.
      // The first sample that actually FOUND containers, not literally the first
      // rAF. MEASURED: rAF can fire before the parser has reached the island, so
      // sample 0 legitimately matches zero containers — and reading that as
      // "not solved" made the proof report "the pre-solved bytes did not reach
      // the DOM" in the same breath as printing data-fit=[settled,settled,...].
      // An empty sample is unknown, not negative.
      solvedAtFirstSample: (() => {
        const first = probe.raf.find((row) => row.c.length > 0);
        return first ? first.c.every((c) => FIT_STATES.includes(c.fit ?? '')) : null;
      })(),
      regressedFromSolved: probe.raf.reduce((count, row, i) => {
        if (i === 0) return count;
        const before = probe.raf[i - 1].c;
        return count + row.c.filter((c, j) => before[j] && FIT_STATES.includes(before[j].fit ?? '') && !FIT_STATES.includes(c.fit ?? '')).length;
      }, 0),
      // CLS
      cls: +probe.shifts.reduce((sum, s) => sum + s.value, 0).toFixed(4),
      clsEntries: probe.shifts.length,
      clsSupported: probe.clsSupported,
      clsRegistered: probe.clsRegistered,
      clsError: probe.clsError,
      mutationsRegistered: probe.mutationsRegistered,
      mutationError: probe.mutationError,
      frames: classified.map((f) => ({ t: +f.t.toFixed(1), uniform: f.uniform, wrong: f.wrong, pixels: f.pixels, extentX: f.extentX })),
    };
  } finally {
    await ctx.close();
  }
}

/**
 * The region the pixel differ watches: the union of the fit containers, clamped
 * into the viewport.
 *
 * MEASURED, and the reason `viewportFor` below exists: on the real site the fit
 * containers sit well below the fold — y=1076 at 390px on /intent/comparison/,
 * y=1944 on /intent/. Against a 900px viewport this produced regions of
 * NEGATIVE height (344x-176, 850x-1044), every frame decoded as uniform, and
 * the composited instrument dutifully reported "0 wrong paints" for a cell where
 * geometry saw a 2222px displacement. A pixel instrument aimed off-screen
 * reports a clean page, which is the same failure as a rule that matches
 * nothing.
 */
function regionFor({ width, height, settled }) {
  const boxes = settled.c;
  if (!boxes.length) return { x: 0, y: 0, w: width, h: height };
  const x = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x))) - 2);
  const y = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y))) - 2);
  const right = Math.ceil(Math.max(...boxes.map((b) => b.x + b.w))) + 2;
  const bottom = Math.ceil(Math.max(...boxes.map((b) => b.y + b.h))) + 2;
  return {
    x,
    y: Math.min(y, Math.max(0, height - 1)),
    w: Math.max(1, Math.min(width, right) - x),
    h: Math.max(1, Math.min(height, bottom) - Math.min(y, Math.max(0, height - 1))),
  };
}

/**
 * The viewport height a cell needs for its subject to be ON SCREEN, which is the
 * only condition under which "was a wrong frame composited" is a question with
 * an answer. Reported per cell, together with whether the subject would have
 * been below the fold in the house viewport — because a flash nobody can see
 * without scrolling is a real mitigation and deserves to be stated, not to be
 * silently converted into a zero.
 */
function viewportFor(settled) {
  const boxes = settled.c;
  if (!boxes.length) return { height: VIEWPORT_HEIGHT, belowFold: false, subjectBottom: 0 };
  const bottom = Math.ceil(Math.max(...boxes.map((b) => b.y + b.h))) + 40;
  const top = Math.floor(Math.min(...boxes.map((b) => b.y)));
  return {
    height: Math.min(4000, Math.max(VIEWPORT_HEIGHT, bottom)),
    belowFold: top >= VIEWPORT_HEIGHT,
    subjectBottom: bottom,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// THE PRE-SOLVE SIMULATION
// ══════════════════════════════════════════════════════════════════════════
// The recipe is the attributes the engine wrote at settle. Rewriting them into
// the served bytes is what an SSG pre-solve WOULD emit, so this measures the
// fix rather than proposing it.
//
// The rewrite is positional — the k-th `data-fit` container and the k-th
// `data-collapse` candidate in document order — because that is the same order
// `querySelectorAll` yields, and it is verified rather than trusted: the caller
// asserts the pre-applied attributes are present at first paint and that the
// number of rewritten sites equals the recipe size. A rewrite that missed
// fails loudly instead of quietly measuring the un-rewritten page.
function captureRecipe(record, probeSettled) {
  return {
    width: record.width,
    containers: probeSettled.c.map((c) => ({ state: c.fit, collapsed: c.cc ?? '0' })),
    candidates: probeSettled.k.map((k) => ({ applied: k.s ? k.s.split('+') : [] })),
    // All THREE of the mutator's outputs, because two of them were not enough.
    overflowShown: probeSettled.o ?? [],
  };
}

function presolveRewriter(recipe) {
  return (html) => {
    let sites = 0;
    let containerSites = 0;
    let containerIndex = 0;
    // `data-fit(?:="")?` — the SSG serialises a valueless attribute as
    // `data-fit=""`, so a pattern anchored on `data-fit` followed by whitespace
    // matched ZERO containers on the real site while still reporting 14
    // rewritten sites from the candidate and overflow passes. The
    // `solvedAtFirstSample` assertion is what caught it: it printed "the
    // pre-solved bytes did not reach the DOM" on six cells whose verdict would
    // otherwise have read as "pre-solve does not eliminate the flash".
    //
    // `containerSites` is counted separately from `sites` for the same reason:
    // "the rewrite touched something" and "the rewrite pre-solved every
    // container" are different claims, and only the second one is the fix.
    let body = html.replace(/data-fit(?:="")?(?=[\s/>])/g, (match) => {
      const entry = recipe.containers[containerIndex];
      containerIndex += 1;
      if (!entry || !entry.state) return match;
      sites += 1;
      containerSites += 1;
      return `data-fit="${entry.state}" data-collapsed-count="${entry.collapsed}"`;
    });
    let candidateIndex = 0;
    body = body.replace(/data-collapse="[^"]*"/g, (match) => {
      const entry = recipe.candidates[candidateIndex];
      candidateIndex += 1;
      if (!entry || !entry.applied.length) return match;
      sites += 1;
      return `${match} ${entry.applied.map((a) => `${a}=""`).join(' ')}`;
    });
    let overflowIndex = 0;
    body = body.replace(/data-overflow(?=[\s/>])/g, (match) => {
      const shown = recipe.overflowShown[overflowIndex];
      overflowIndex += 1;
      if (!shown) return match;
      sites += 1;
      return 'data-overflow data-shown=""';
    });
    return { body, sites, containerSites, containersWanted: recipe.containers.filter((c) => c.state).length };
  };
}

// ══════════════════════════════════════════════════════════════════════════
// THE SELF-CONTAINED FIXTURE
// ══════════════════════════════════════════════════════════════════════════
// A subject the proof owns end to end, so the instrument is provable without
// the site. It is NOT a copy of intent: the stylesheet is the shipped
// `packages/intent/theme/index.css` served straight off disk, and the measured
// pass is the shipped `fit()` bundled in memory from
// `packages/intent/src/index.ts`. What the fixture supplies is the SSG-shaped
// HTML and a controlled hydration delay, which is precisely the variable under
// test.
async function buildFixture({ hydrationDelayMs }) {
  const { build } = await import('vite');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: {
        '@nisli/intent': join(intentDir, 'src', 'index.ts'),
        '@nisli/core': join(repoRoot, 'packages', 'core', 'src', 'index.ts'),
      },
    },
    build: {
      write: false,
      target: 'es2022',
      minify: false,
      lib: { entry: join(intentDir, 'src', 'index.ts'), formats: ['es'], fileName: 'intent' },
    },
  });
  const chunk = (Array.isArray(result) ? result[0].output : result.output).find((o) => o.type === 'chunk');
  assert.ok(chunk, 'vite produced no chunk for the intent fixture bundle');

  // The island: static markup with declarations and NO solved state, exactly
  // the shape IntentSurfaces confirmed the SSG emits. Zero pixel values, zero
  // colours, zero breakpoints, zero class names — the vocabulary only.
  const row = (title, excerpt, time) => `
    <div data-fit data-layout="row" data-align="center">
      <span data-appearance="avatar">NB</span>
      <span data-text="title" data-grow>${title}</span>
      <span data-text="body" data-collapse="truncate" data-priority="5" data-grow>${excerpt}</span>
      <span data-text="meta" data-collapse="hide" data-priority="4">${time}</span>
      <span data-collapse="menu" data-priority="2"><button data-appearance="action" data-role="quiet">Archive</button></span>
      <button data-appearance="action" data-role="primary">Reply</button>
      <button data-appearance="action" data-role="quiet" data-overflow aria-label="More">…</button>
    </div>`;

  // The toolbar. Priority DESCENDS along the row, so the solver spends the
  // rightmost groups first and the primary is never lost — the ladder is the
  // author's declaration, not the engine's guess.
  const toolbar = (title, actions) => `
    <div data-fit data-layout="row" data-align="center">
      <span data-text="label">${title}</span>
      <button data-appearance="action" data-role="primary">${actions[0]}</button>
      ${actions
        .slice(1)
        .map(
          (label, index) =>
            `<span data-collapse="menu" data-priority="${Math.min(5, 2 + index)}"><button data-appearance="action" data-role="quiet">${label}</button></span>`,
        )
        .join('\n      ')}
      <button data-appearance="action" data-role="quiet" data-overflow aria-label="More actions">…</button>
    </div>`;

  const html = `<!doctype html>
<html lang="en" data-theme="light" data-density="comfortable" data-input="pointer">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>intent fixture</title>
<link rel="stylesheet" href="/intent-theme/index.css" />
</head>
<body>
<main data-layout="stack">
  <!-- The roomy cell: a full-width row that FITS unsolved at a wide viewport.
       This is the zero baseline, and it is what makes a nonzero number
       elsewhere mean something. -->
  <div data-hydrate="intent" data-intent="fixture-roomy">
    <div data-appearance="surface">${row('Quarterly platform review and rollout plan', 'The measured tier spends the least important declaration first, in the order the author declared it, and stops.', '11:42')}</div>
  </div>

  <!-- The tight cells. A toolbar, because that is where the measured tier
       earns its keep: an action is white-space: nowrap by declaration
       (roles.css:87 — "a control is an atom"), so a row of them cannot relieve
       pressure by reflowing and the container overflows HONESTLY. At the widest
       measured viewport the solver must spend the least important groups before
       it can settle, which is what makes the non-vacuity floor an observation
       rather than a hope. No width is written here; the pressure is content
       against a derived control size.

       TWO MEASUREMENTS RECORDED, because both obvious constructions failed:

       1. These rows first sat inside a data-layout="grid", on the theory that
          auto-fit tracks floored at the min-track token would squeeze them at a
          wide viewport. They were not squeezed at any width. A grid ITEM keeps
          its automatic minimum size, so a nowrap row's min-content contribution
          expands the track past its 1fr share; the grid overflows the page and
          the fit container is never under pressure. A fit container needs a
          BOUNDING ancestor, and a grid cell is not one.

       2. The pressure was then supplied by a ~300-character excerpt. Still
          collapsed=0 at 1280, and correctly so: body text wraps, so its
          min-content contribution is its longest WORD. A long paragraph in a
          row buys height, not horizontal pressure. Only content that cannot
          reflow — controls, avatars, timestamps — moves the solver. -->
  <div data-hydrate="intent" data-intent="fixture-tight-1">
    <div data-appearance="surface">${toolbar('Review queue', ['Approve', 'Request changes', 'Reassign', 'Snooze', 'Add label', 'Move to project', 'Duplicate', 'Archive', 'Export', 'Share', 'Watch thread', 'Mark resolved', 'Link issue', 'Copy permalink', 'Report abuse', 'Open in editor'])}</div>
  </div>
  <div data-hydrate="intent" data-intent="fixture-tight-2">
    <div data-appearance="surface">${toolbar('Deployment history', ['Promote', 'Roll back', 'Compare builds', 'Download logs', 'Pin revision', 'Notify channel', 'Open incident', 'Retry failed', 'Cancel run', 'Freeze pipeline', 'Rerun checks', 'Attach artefact', 'Diff config', 'Tag release', 'Invalidate cache'])}</div>
  </div>
</main>
<script type="module" src="/fixture/hydrate.js"></script>
</body>
</html>`;

  // The hydration entry. Deferred by a controlled delay so the window under
  // measurement is a KNOWN quantity in the fixture and an OBSERVED one on the
  // real site.
  const hydrate = `${chunk.code}
const start = () => { solveAll(document); };
setTimeout(start, ${hydrationDelayMs});
`;

  return new Map([
    ['/fixture/', { type: 'text/html', body: html }],
    ['/fixture/hydrate.js', { type: 'text/javascript', body: hydrate }],
  ]);
}

// ══════════════════════════════════════════════════════════════════════════
// CALIBRATION — the instrument against a defect of KNOWN magnitude
// ══════════════════════════════════════════════════════════════════════════
// Deliberately literal-valued and deliberately free of intent vocabulary: a
// calibration target must be known INDEPENDENTLY of the system under test, so
// this fixture is an instrument, not a surface. It is the only place in this
// file with a pixel value, and that is what makes the pixel values elsewhere
// unnecessary.
function calibrationRoutes({ defectPx, durationMs }) {
  const html = `<!doctype html><html><head><style>
body { margin: 0; font: 14px system-ui; background: #fff; }
[data-hydrate="intent"] { padding: 20px; }
[data-fit] { width: 400px; overflow: hidden; white-space: nowrap; height: 60px; background: #eeeef2; }
[data-collapse] { display: inline-block; width: ${400 + defectPx}px; height: 40px; background: #303040; }
[data-collapse][data-truncate] { width: 380px; }
.copy { font: 16px system-ui; }
</style></head><body>
<p class="copy">Calibration: a known ${defectPx}px overflow, resolved after ${durationMs}ms.</p>
<div data-hydrate="intent" data-intent="calibration">
  <div data-fit><span data-collapse="truncate" data-priority="5"></span></div>
</div>
<script>
setTimeout(() => {
  const c = document.querySelector('[data-fit]');
  c.querySelector('[data-collapse]').setAttribute('data-truncate', '');
  c.setAttribute('data-fit', 'settled');
  c.setAttribute('data-collapsed-count', '1');
}, ${durationMs});
</script></body></html>`;
  return new Map([['/calibration/', { type: 'text/html', body: html }]]);
}

// ══════════════════════════════════════════════════════════════════════════
// PRECONDITIONS, AND WHY THE SUBJECT IS STAGED
// ══════════════════════════════════════════════════════════════════════════
// dist/ is a shared build artefact, and while this proof was being written a
// sibling agent's `pnpm --filter @nisli/www build` emptied and rewrote it three
// separate times mid-run. The observable damage was not a crash: one run
// reported 0 fit containers, no first-contentful-paint and blank composited
// frames on every page — a perfectly formatted verdict of "no flash" about a
// document root that had ceased to exist. A measurement whose subject can be
// rewritten underneath it is not a measurement.
//
// So the precondition COPIES dist/ to a private staging directory and every
// byte the browser sees comes from that copy. The staged tree is the shipped
// tree — nothing is substituted or rebuilt — and the file count and byte total
// are printed so the snapshot's provenance is part of the record.
async function countTree(dir) {
  let files = 0;
  let bytes = 0;
  const walk = async (path) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      else {
        files += 1;
        bytes += (await stat(child)).size;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}

async function requireBuiltSite(routes) {
  const missing = [];
  const required = [
    ['dist/ui-preview/hydrate.js', join(distDir, 'ui-preview', 'hydrate.js')],
    ...routes.map((route) => [`dist${route}index.html`, join(distDir, route.replace(/^\/+|\/+$/g, ''), 'index.html')]),
  ];
  for (const [label, path] of required) {
    const info = await stat(path).catch(() => undefined);
    if (!info?.isFile()) missing.push(label);
  }
  if (missing.length) {
    throw new Error(
      `intent-ssg proof precondition: ${missing.join(', ')} absent.\n` +
        '  Run `pnpm --filter @nisli/www build` first. This proof deliberately does NOT\n' +
        '  build or substitute its own assets: a proof that provisions its own subject is\n' +
        '  measuring something other than the shipped site.\n' +
        '  For a subject-free run of the same instrument: --fixture, --calibrate, --self-test.',
    );
  }

  const root = await mkdtemp(join(tmpdir(), 'intent-ssg-proof-'));
  await cp(distDir, root, { recursive: true });
  const tree = await countTree(root);

  // The stylesheet set is DERIVED from the staged HTML rather than named here.
  // Measured reason: the theme does not live in the site bundle. WireIntent
  // emits it as a separate /assets/intent.css linked only on intent routes, and
  // a precondition that names dist/assets/site.css reports "the theme is
  // missing" about a page that carries it perfectly well.
  const html = await readFile(join(root, routes[0].replace(/^\/+|\/+$/g, ''), 'index.html'), 'utf8');
  const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(sheets.length, `intent-ssg proof precondition: ${routes[0]} links no stylesheet at all`);
  let cssBytes = 0;
  let combined = '';
  for (const href of sheets) {
    const body = await readFile(join(root, href.replace(/^\/+/, '')), 'utf8').catch(() => undefined);
    if (body === undefined) {
      await rm(root, { recursive: true, force: true });
      throw new Error(`intent-ssg proof precondition: ${routes[0]} links ${href}, which is not in dist/. Run \`pnpm --filter @nisli/www build\`.`);
    }
    cssBytes += body.length;
    combined += body;
  }
  const themeMarkers = ['data-appearance', 'data-collapse', 'unit-base'];
  const absent = themeMarkers.filter((marker) => !combined.includes(marker));
  if (absent.length) {
    await rm(root, { recursive: true, force: true });
    throw new Error(
      `intent-ssg proof precondition: the stylesheets ${routes[0]} links (${sheets.join(', ')}) do not carry intent's theme (missing ${absent.join(', ')}).\n` +
        "  The static tier cannot be measured from a bundle that does not contain it. Check that src/styles/intent.css imports '@nisli/intent/theme.css'.",
    );
  }
  return { cssBytes, sheets, root, tree, staged: relative(wwwDir, root) || root };
}

// ══════════════════════════════════════════════════════════════════════════
// THE INERTNESS MEASUREMENT
// ══════════════════════════════════════════════════════════════════════════
// intent ships `states.css` UNLAYERED — so it outranks every Tailwind layer
// regardless of specificity — and computes its unit on a UNIVERSAL selector, so
// that declaration lands on every Tailwind-authored element in the document.
// Both are correct inside intent. "Should be inert against site chrome" is not
// "measured inert", and this repository has recorded eight oracle bugs found in
// exactly that gap.
//
// Two questions, because the site answers them differently:
//
//   REACH — does a non-intent page even load the theme? WireIntent emits it as
//     a separate /assets/intent.css linked only on intent routes, so on /docs/
//     the hazard is absent by construction rather than inert by luck. That is
//     the stronger result and it is checked rather than assumed.
//   CO-RESIDENCE — on an intent page BOTH bundles are live, and that is where
//     the hazard is real. Every rule intent contributes is deleted from the live
//     stylesheets and the SITE CHROME is re-read: elements carrying no intent
//     declaration and sitting outside every intent island. Anything that moves
//     is intent reaching into chrome it never declared.
// `alignItems` is in this list because it is the measured collision vector, not
// a guess: intent's `structure` layer selects `[data-align='start'|'end']`, and
// nisli-ui already writes `data-align` on its own components. `borderRadius` is
// here for the same reason — before the tokens were namespaced, intent's
// universal rule declared `--radius`, which nisli-ui derives its whole ramp
// from, and every corner on every page tightened.
//
// The split is load-bearing. `blockSize` and `flexBasis` are functions of an
// element's DESCENDANTS, so on an intent page every ancestor of an island
// changes height the moment intent's rules are deleted — measured: the page's
// <main> went 5049.88px -> 5432.88px, which is the island's own content
// resizing, not a cascade leak into chrome. Comparing those two properties on
// an element that CONTAINS an island reports structural coupling as a defect, so
// they are compared only where no island sits inside.
const CHROME_INTRINSIC = ['fontSize', 'color', 'backgroundColor', 'paddingLeft', 'borderRadius', 'lineHeight', 'fontWeight', 'alignItems', 'display'];
const CHROME_DESCENDANT_DEPENDENT = ['blockSize', 'flexBasis'];
const INTENT_SELECTORS = [
  'data-appearance', 'data-text', 'data-layout', 'data-fit', 'data-collapse', 'data-truncate',
  'data-hidden', 'data-collapsed', 'data-density', 'data-input', 'data-theme', 'data-overflow',
  'data-grow', 'data-align', 'data-clip', 'data-priority', 'data-flush', 'data-shown',
];

async function measureInertness({ browser, base, intentRoute, controlRoute = '/docs/' }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();

    // REACH.
    await page.goto(`${base}${controlRoute}`, { waitUntil: 'networkidle' });
    const controlSheets = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.href).pathname));
    const controlCarriesTheme = await page.evaluate(
      ([markers]) => {
        for (const sheet of document.styleSheets) {
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          const scan = (list) => {
            for (const rule of list) {
              if (rule.cssRules) {
                if (scan(rule.cssRules)) return true;
                continue;
              }
              if (rule.selectorText && markers.some((m) => rule.selectorText.includes(m))) return true;
            }
            return false;
          };
          if (scan(rules)) return true;
        }
        return false;
      },
      [INTENT_SELECTORS],
    );

    // CO-RESIDENCE.
    await page.goto(`${base}${intentRoute}`, { waitUntil: 'networkidle' });
    // WHAT COUNTS AS CHROME, and why the obvious predicate is a vacuity trap.
    //
    // The first spelling excluded any element carrying an attribute intent's
    // selectors address. That excludes exactly the interesting population:
    // nisli-ui already writes `data-align` on its own components, so an
    // ATTRIBUTE NAMESPACE COLLISION — the one class of defect no token rename
    // can fix — is invisible to a check that treats "has data-align" as "is
    // intent's". Measured elsewhere in this batch: 39 changed properties and 17
    // changed boxes on /ui/bubble, /ui/message and /ui/message-scroller, where
    // rows stopped stretching (160px -> 36px, a 724px scroller collapse) purely
    // because intent's `structure` layer outranks Tailwind's utilities.
    //
    // So chrome is defined by AUTHORSHIP: Tailwind-authored elements carry class
    // names and sit outside every intent island; intent-declared surfaces carry
    // data-* declarations and no classes. The collision surface is counted
    // separately rather than filtered away.
    const readChrome = () =>
      page.evaluate(
        ([markers, intrinsic, dependent]) => {
          const inIsland = (node) => node.closest('[data-hydrate="intent"]') !== null || node.tagName.includes('-');
          const nodes = [...document.querySelectorAll('body *')].filter((n) => !inIsland(n) && n.getAttribute('class'));
          return {
            rows: nodes.map((n) => {
              const s = getComputedStyle(n);
              const holdsIsland = n.querySelector('[data-hydrate="intent"]') !== null;
              const read = holdsIsland ? intrinsic : [...intrinsic, ...dependent];
              return `${n.tagName}.${n.getAttribute('class').split(/\s+/).slice(0, 2).join('.')}|${read.map((p) => s[p]).join('|')}`;
            }),
            // Chrome elements that happen to spell a word intent selects on.
            collisions: nodes.filter((n) => markers.some((m) => n.hasAttribute(m))).length,
            // How much of the population was measured on intrinsic properties
            // only, so a shrinking comparison cannot pass as a clean one.
            ancestorsOfIslands: nodes.filter((n) => n.querySelector('[data-hydrate="intent"]') !== null).length,
          };
        },
        [INTENT_SELECTORS, CHROME_INTRINSIC, CHROME_DESCENDANT_DEPENDENT],
      );

    const before = await readChrome();
    const rulesRemoved = await page.evaluate(
      ([markers]) => {
        let count = 0;
        // `deleteRule` lives on the OWNER — the stylesheet or the grouping rule
        // (@layer, @media, @supports) — never on the CSSRuleList it hands out.
        // intent's whole table is inside @layer blocks, so recursing on the list
        // and calling deleteRule on it throws on the very first layer.
        const drop = (owner) => {
          let rules;
          try {
            rules = owner.cssRules;
          } catch {
            return;
          }
          if (!rules) return;
          for (let i = rules.length - 1; i >= 0; i -= 1) {
            const rule = rules[i];
            const selector = rule.selectorText;
            if (!selector) {
              drop(rule);
              continue;
            }
            // The universal rule is intent's derived-token carrier and the half
            // of the hazard that lands on every element in the document.
            if (selector.trim() === '*' || markers.some((m) => selector.includes(m))) {
              owner.deleteRule(i);
              count += 1;
            }
          }
        };
        for (const sheet of document.styleSheets) drop(sheet);
        return count;
      },
      [INTENT_SELECTORS],
    );
    const after = await readChrome();
    const moved = before.rows.map((row, i) => [row, after.rows[i]]).filter(([a, b]) => a !== b);

    return {
      controlRoute, intentRoute, controlSheets, controlCarriesTheme,
      chromeElementsRead: before.rows.length,
      collisionSurface: before.collisions,
      ancestorsOfIslands: before.ancestorsOfIslands,
      rulesRemoved,
      moved: moved.length,
      examples: moved.slice(0, 4).map(([a, b]) => `${a}\n      -> ${b}`),
    };
  } finally {
    await ctx.close();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════
// Nine named paths. Every one has a counterfactual in `--self-test` that makes
// it fail, because a proof that has never been observed to fail is decoration.
function checkSubjectExists(records, failures) {
  const transitions = records.filter((r) => r.solveMutations > 0);
  if (!transitions.length) {
    failures.push(
      new Error(
        'subject-exists: no container transitioned from unsolved to solved on any measured page. ' +
          'The measured tier never ran, so there is no flash to measure and every Q2 number below is an absence, not a zero.',
      ),
    );
    return;
  }
  const widest = records.filter((r) => r.width === Math.max(...records.map((x) => x.width)));
  if (!widest.some((r) => r.collapsedTotal > 0)) {
    failures.push(
      new Error(
        `subject-exists: settled collapsed-count is 0 at the widest measured viewport (${widest[0]?.width}px) on every page. ` +
          'Nothing degraded, so the solver had no work and the flash measurement is vacuous. Harsher content is the fix, not a softer assertion.',
      ),
    );
  }
}

function checkInstrumentLive(records, failures) {
  for (const r of records) {
    if (!r.containers) failures.push(new Error(`instrument-live: ${r.mode} ${r.route} ${r.width}px matched 0 fit containers — the selector "${CONTAINER}" found nothing`));
    if (r.sample && !r.rafSamples) failures.push(new Error(`instrument-live: ${r.mode} ${r.route} ${r.width}px collected 0 rAF samples`));
    if (!r.framesDelivered) failures.push(new Error(`instrument-live: ${r.mode} ${r.route} ${r.width}px received 0 composited frames — the screencast delivered nothing to classify`));
    if (r.firstCompositedPaintMs === null) {
      failures.push(
        new Error(
          `instrument-live: ${r.mode} ${r.route} ${r.width}px — every composited frame was a uniform region, so the subject never painted anything ` +
            'in the watched area and "0 wrong frames" is an absence rather than a clean result',
        ),
      );
    }
    if (!r.mutationsRegistered) {
      failures.push(
        new Error(
          `instrument-live: ${r.mode} ${r.route} ${r.width}px never registered the attribute-mutation observer (${r.mutationError ?? 'no error reported'}) — ` +
            'so "0 solve writes" would mean "unmeasured", not "the engine never solved"',
        ),
      );
    }
    if (r.errors.length) failures.push(new Error(`instrument-live: ${r.mode} ${r.route} ${r.width}px browser errors: ${r.errors.slice(0, 3).join('; ')}`));
  }
}

function checkInstrumentsCorroborate(records, failures) {
  // Only the SAMPLED passes carry a geometry stream. Corroborating a quiet pass
  // would compare the pixel differ against an instrument that was never
  // installed, and "0 because nothing measured" is the exact confusion this
  // check exists to refuse.
  for (const r of records.filter((row) => row.sample)) {
    const geometric = r.transientOverflowPx > OVERFLOW_TOLERANCE || r.maxDisplacementPx > OVERFLOW_TOLERANCE;
    const visual = r.compositedWrongStates > 0;
    if (geometric && !visual) {
      failures.push(
        new Error(
          `instruments-corroborate: ${r.mode} ${r.route} ${r.width}px — geometry saw a ${r.maxDisplacementPx}px displacement / ${r.transientOverflowPx}px transient overflow ` +
            'but the pixel differ classified no composited frame wrong. Either the watched region is mis-aimed or the defect was never on screen; ' +
            'both are reasons not to believe the pixel number, so the disagreement is the failure.',
        ),
      );
    }
    if (visual && !geometric) {
      failures.push(
        new Error(
          `instruments-corroborate: ${r.mode} ${r.route} ${r.width}px — ${r.compositedWrongStates} wrong composited frame(s) over ${r.worstVisibleExtentPx}px ` +
            'while geometry measured no overflow and no displacement. The pixels moved for a reason the geometry instrument cannot name.',
        ),
      );
    }
  }
}

function checkClsObservable(records, failures) {
  for (const r of records) {
    if (!r.clsSupported) failures.push(new Error(`cls-observable: ${r.mode} ${r.route} ${r.width}px — 'layout-shift' is not in PerformanceObserver.supportedEntryTypes, so its 0 means "unmeasurable", not "clean"`));
    if (!r.clsRegistered) failures.push(new Error(`cls-observable: ${r.mode} ${r.route} ${r.width}px — the layout-shift observer never registered (${r.clsError ?? 'no error reported'}); a silent 0 is indistinguishable from a clean page`));
  }
}

function checkPresolve(matched, failures) {
  for (const r of matched) {
    if (!r.rewriteSites) {
      failures.push(new Error(`presolve-eliminates: ${r.route} ${r.width}px — the HTML rewrite touched 0 sites, so the "pre-solved" page is the un-rewritten page`));
      continue;
    }
    // TWO DIFFERENT FAILURES that used to share one message. If the bytes never
    // carried the state, the rewrite missed and the cell is measuring the
    // shipped page. If the bytes carried it and the DOM does not, the mount
    // DISCARDED it — which is the actual answer to "would SSG pre-solve work
    // through a replace-mount island", and a different owner entirely.
    if (r.rewriteContainers < r.rewriteContainersWanted) {
      failures.push(
        new Error(
          `presolve-eliminates: ${r.route} ${r.width}px — the rewrite pre-solved ${r.rewriteContainers} of ${r.rewriteContainersWanted} container(s) in the served bytes, ` +
            'so this cell measures a partially rewritten page rather than a pre-solved one.',
        ),
      );
      continue;
    }
    if (r.solvedAtFirstSample === false) {
      failures.push(
        new Error(
          `presolve-eliminates: ${r.route} ${r.width}px — all ${r.rewriteContainersWanted} container(s) carried the solved state IN THE SERVED BYTES, yet the first ` +
            `sampled frame that saw a container found it unsolved (settled state now data-fit=[${r.fitStates.join(',')}], ` +
            `${r.regressedFromSolved} observed regression(s)). The island's replace-mount re-rendered the subtree from the component and threw the ` +
            'pre-solved attributes away, so pre-solving the HTML cannot close the window on this page without the mount preserving them.',
        ),
      );
      continue;
    }
    if (r.compositedWrongStates > 0) {
      failures.push(
        new Error(
          `presolve-eliminates: ${r.route} ${r.width}px — pre-solving the served bytes for THIS viewport still left ${r.compositedWrongStates} wrong composited frame(s) ` +
            `(${r.compositedWrongMs}ms, ${r.worstVisibleExtentPx}px wide, geometry ${r.maxDisplacementPx}px). Pre-solve alone does not close the window here.`,
        ),
      );
    }
  }
}

function checkCalibration(record, failures, { defectPx, durationMs }) {
  // Checked against `transientOverflowPx`, the metric the VERDICT uses, so the
  // calibration validates the number that decides the result rather than a
  // neighbouring one that happens to agree today.
  if (Math.abs(record.transientOverflowPx - defectPx) > 2) {
    failures.push(
      new Error(`calibration: injected a known ${defectPx}px overflow, the geometry instrument recovered ${record.transientOverflowPx}px`),
    );
  }
  if (!record.compositedWrongStates) {
    failures.push(new Error(`calibration: injected a ${defectPx}px defect lasting ${durationMs}ms and the composited instrument classified 0 frames wrong`));
  }
  if (record.compositedWrongMs !== null && Math.abs(record.compositedWrongMs - durationMs) > durationMs * 0.6 + 40) {
    failures.push(new Error(`calibration: injected a ${durationMs}ms window, the composited instrument measured ${record.compositedWrongMs}ms`));
  }
  if (!record.naiveUnfitFrames) failures.push(new Error('calibration: the naive rAF instrument saw 0 unfit frames against a known defect'));
}

// ══════════════════════════════════════════════════════════════════════════
// REPORTING
// ══════════════════════════════════════════════════════════════════════════
function reportFlash(label, r) {
  const phases = [
    r.fcpMs !== null ? `fcp ${r.fcpMs.toFixed(1)}ms` : 'fcp —',
    r.firstCompositedPaintMs !== null
      ? `1st composited paint ${r.firstCompositedPaintMs}ms (skew ${r.fcpMs !== null ? (r.firstCompositedPaintMs - r.fcpMs).toFixed(1) : '?'}ms)`
      : '1st composited paint —',
    r.hydrateJs ? `hydrate.js ${r.hydrateJs.start}→${r.hydrateJs.end}ms` : 'hydrate.js —',
    r.chunks.length ? `chunks ${r.chunks[0].start}→${Math.max(...r.chunks.map((c) => c.end))}ms (${r.chunks.length})` : 'chunks —',
    r.firstSolveMs !== null ? `first solve ${r.firstSolveMs}ms` : 'first solve —',
  ].join('  ');
  console.log(
    `  ${label}\n` +
      `    read: ${r.containers} container(s), ${r.candidates} candidate(s), ${r.rafSamples} rAF samples, ` +
      `${r.framesDelivered} composited frame(s) (${r.blankFrames} blank), region ${r.regionPx.w}x${r.regionPx.h}@${r.regionPx.x},${r.regionPx.y}, frame ${Number.isFinite(r.frameMs) ? r.frameMs.toFixed(1) : '?'}ms\n` +
      `    phases: ${phases}\n` +
      `    settled: data-fit=[${r.fitStates.join(',')}] collapsed=${r.collapsedTotal} solve-writes=${r.solveMutations} regressions=${r.regressedFromSolved}\n` +
      `    NAIVE (rAF):      ${r.naiveUnfitFrames} unfit frame(s) (${r.naiveUnfitFramesAfterPaint} after first paint), ${r.naiveUnfitMs}ms span\n` +
      `    COMPOSITED:       ${r.compositedWrongStates} wrong paint(s), ${r.compositedWrongMs}ms on screen ≈ ${r.compositedWrongFrames} frame(s), worst visible ${r.worstVisibleExtentPx}x${r.worstVisibleRowsPx}px (${r.worstVisiblePixels}px²)\n` +
      `    GEOMETRY:         transient overflow ${r.transientOverflowPx}px (settled residual ${r.settledOverflowPx}px, absolute peak ${r.maxOverflowPx}px), displacement ${r.maxDisplacementPx}px\n` +
      `    CLS:              ${r.cls} from ${r.clsEntries} entr(y|ies) [supported=${r.clsSupported} registered=${r.clsRegistered}]`,
  );
}

function clsVerdict(records) {
  const rows = records.map((r) => ({
    label: `${r.mode} ${r.route} ${r.width}px`,
    defect: Math.max(r.transientOverflowPx, r.maxDisplacementPx) > OVERFLOW_TOLERANCE,
    visible: r.compositedWrongStates > 0,
    cls: r.cls,
  }));
  const blindSpots = rows.filter((r) => r.visible && r.cls === 0);
  const falsePositives = rows.filter((r) => !r.defect && !r.visible && r.cls > 0);
  return { rows, blindSpots, falsePositives };
}

// ══════════════════════════════════════════════════════════════════════════
// RUNS
// ══════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(`--${flag}`);
const value = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const CALIBRATION = { defectPx: 240, durationMs: 150 };

async function runCalibration({ browser, decoder, failures, expectDefectPx = CALIBRATION.defectPx }) {
  const { server, base } = await startServer({ routes: calibrationRoutes({ ...CALIBRATION, defectPx: expectDefectPx }) });
  try {
    const record = await measureFlash({ browser, decoder, base, route: '/calibration/', width: 1280 });
    record.mode = 'calibration';
    console.log(`\ncalibration — a KNOWN ${expectDefectPx}px overflow resolved after ${CALIBRATION.durationMs}ms:`);
    reportFlash(`/calibration/ 1280px`, record);
    checkCalibration(record, failures, { defectPx: CALIBRATION.defectPx, durationMs: CALIBRATION.durationMs });
    // The clipped-defect lesson, measured here rather than asserted: the row
    // clips its overflow, so only the band between the unsettled and settled
    // edge was ever ON SCREEN. Geometry says 240px, a reader saw 20px, and CLS
    // says nothing at all because a sideways overflow moves nothing. This is
    // the whole reason the proof carries three instruments instead of one.
    const geometric = record.transientOverflowPx;
    console.log(
      `    clipping: geometry ${geometric}px vs visible ${record.worstVisibleExtentPx}px — ` +
        (geometric > record.worstVisibleExtentPx
          ? `${(100 - (record.worstVisibleExtentPx / geometric) * 100).toFixed(0)}% of the defect was clipped and never composited.`
          : 'no clipped remainder to report at this injected magnitude.') +
        ` CLS ${record.cls}.`,
    );
    return record;
  } finally {
    await closeServer(server);
  }
}

async function runSubject({ browser, decoder, base, routes, widths, failures }) {
  const flashRecords = [];
  const presolveMatched = [];
  const presolveCrossed = [];
  /** Per (route,width): the settled snapshot, and the viewport its subject needs. */
  const cells = new Map();
  const key = (route, width) => `${route}@${width}`;

  for (const route of routes) {
    for (const width of widths) {
      const settled = await settledSnapshot({ browser, base, route, width });
      const view = viewportFor(settled);
      cells.set(key(route, width), { settled, view });
    }
  }

  for (const route of routes) {
    for (const width of widths) {
      const { view } = cells.get(key(route, width));
      const height = view.height;
      const record = await measureFlash({ browser, decoder, base, route, width, height, sample: true });
      flashRecords.push(record);
      reportFlash(`${route} ${width}x${height}px  [as-shipped, sampled]`, record);
      if (view.belowFold) {
        console.log(
          `    below the fold:   the subject starts past y=${VIEWPORT_HEIGHT} and ends at y=${view.subjectBottom}, so the viewport was grown to ${height}px ` +
            'to put it on screen. In the house 900px viewport this flash is not visible without scrolling — a real mitigation, stated rather than silently scored as zero.',
        );
      }

      // Probe effect: the same load with the rAF loop removed. The naive
      // instrument forces synchronous layout every frame; this is how much that
      // costs, reported rather than assumed negligible.
      const quiet = await measureFlash({ browser, decoder, base, route, width, height, sample: false });
      const drift =
        record.compositedWrongMs !== null && quiet.compositedWrongMs !== null ? +(record.compositedWrongMs - quiet.compositedWrongMs).toFixed(1) : null;
      console.log(`    probe effect:     sampled ${record.compositedWrongMs}ms vs quiet ${quiet.compositedWrongMs}ms (Δ ${drift}ms) — the naive loop's own cost`);
      flashRecords.push(quiet);
    }
  }

  // ── the pre-solve simulation ────────────────────────────────────────────
  // One recipe per route per extreme viewport, applied MATCHED (the viewport it
  // was captured at) and CROSSED (the other one), because the SSG emits one
  // HTML for every viewport and that is the question a per-viewport solve
  // cannot dodge.
  for (const route of routes) {
    const widest = Math.max(...widths);
    const narrowest = Math.min(...widths);
    for (const width of new Set([widest, narrowest])) {
      const cell = cells.get(key(route, width));
      if (!cell?.settled.c.length) continue;
      const rewrite = presolveRewriter(captureRecipe({ width }, cell.settled));

      const matched = await measureFlash({
        browser, decoder, base, route, width, height: cell.view.height,
        hooks: { label: `presolve@${width}`, rewriteHtml: rewrite },
      });
      presolveMatched.push(matched);
      reportFlash(`${route} ${width}px  [PRE-SOLVED for ${width}px — the SSG fix, simulated]`, matched);

      const other = width === widest ? narrowest : widest;
      if (other === width) continue;
      const crossed = await measureFlash({
        browser, decoder, base, route, width: other, height: cells.get(key(route, other))?.view.height ?? VIEWPORT_HEIGHT,
        hooks: { label: `presolve@${width}→${other}`, rewriteHtml: rewrite },
      });
      presolveCrossed.push(crossed);
      reportFlash(`${route} ${other}px [PRE-SOLVED for ${width}px, LOADED at ${other}px — one HTML, many viewports]`, crossed);
    }
  }

  checkSubjectExists(flashRecords.filter((r) => r.sample), failures);
  checkInstrumentLive([...flashRecords, ...presolveMatched, ...presolveCrossed], failures);
  checkInstrumentsCorroborate([...flashRecords, ...presolveMatched, ...presolveCrossed], failures);
  checkClsObservable(flashRecords, failures);
  checkPresolve(presolveMatched, failures);
  return { flashRecords, presolveMatched, presolveCrossed };
}

/** A settled load whose per-node detail becomes the pre-solve recipe. */
async function settledSnapshot({ browser, base, route, width }) {
  const ctx = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.addInitScript(instrumentSource({ container: CONTAINER, candidate: CANDIDATE, sample: false }));
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(SETTLE_QUIET_MS);
    return await page.evaluate(() => window.__intentProbe.snap());
  } finally {
    await ctx.close();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SELF-TEST — every assertion, observed failing
// ══════════════════════════════════════════════════════════════════════════
async function requireFailure(name, run) {
  const failures = [];
  let thrown;
  try {
    await run(failures);
  } catch (error) {
    thrown = error;
  }
  const total = failures.length + (thrown ? 1 : 0);
  assert.ok(total > 0, `self-test: "${name}" PASSED under its counterfactual — that assertion is vacuous and proves nothing`);
  const first = failures[0] ?? thrown;
  console.log(`  ✓ ${name.padEnd(26)} fails as required: ${String(first.message).split('\n')[0].slice(0, 132)}`);
}

async function runSelfTest({ browser, decoder, base, routes, width }) {
  console.log('\n── self-test: every assertion, observed failing ──────────────────────');

  await requireFailure('static-derived', async (failures) => {
    // Block the stylesheet the subject actually loads. `**/*.css` rather than a
    // named bundle on purpose: the first spelling of this lever named
    // dist/assets/site.css, which the fixture does not serve, so the lever
    // changed nothing and the self-test correctly reported the assertion as
    // vacuous. A counterfactual that misses is indistinguishable from an
    // assertion that cannot fail.
    const record = await measureStaticTier({ browser, base, route: routes[0], context: CONTEXTS[0], block: ['**/*.css'] });
    checkStaticTier([record], failures, { minReadings: 1 });
  });

  await requireFailure('static-derived/vacuity', async (failures) => {
    checkStaticTier([{ route: routes[0], readings: [], solvedCount: 0 }], failures, { minReadings: 1 });
  });

  await requireFailure('static-no-js-solve', async (failures) => {
    // Same reading with script execution ENABLED: the engine writes its state,
    // so a "no solved state" claim must fail. If it passes, the check is not
    // looking at the attributes the engine actually writes.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${base}${routes[0]}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(SETTLE_QUIET_MS);
      const solvedCount = await page.evaluate(
        ([states, attrs]) =>
          document.querySelectorAll([...states.map((s) => `[data-fit="${s}"]`), '[data-collapsed-count]', ...attrs.map((a) => `[${a}]`)].join(',')).length,
        [FIT_STATES, STRATEGY_ATTRS],
      );
      checkStaticTier([{ route: routes[0], readings: [], solvedCount }], failures, { minReadings: 0 });
    } finally {
      await ctx.close();
    }
  });

  await requireFailure('subject-exists', async (failures) => {
    // Take the candidates away from the solver, so nothing can degrade and the
    // settled collapsed-count is 0.
    //
    // MEASURED, and the reason this is an engine-level patch rather than an HTML
    // rewrite: the surfaces are REPLACE-MOUNT islands. `hydrate.js` swaps the
    // static subtree for the component's own render, so rewriting
    // `data-collapse` in the served bytes changes nothing the solver ever sees —
    // the lever ran, the page still degraded, and the self-test correctly
    // reported the assertion as vacuous. The same fact is why pre-solving this
    // page's HTML cannot close its window.
    //
    // `discoverCandidates` reads `container.querySelectorAll('[data-collapse]')`
    // (packages/intent/src/fit/dom.ts:246), so emptying exactly that query is
    // the narrowest way to make "no candidates" true wherever the DOM came from.
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: {
        label: 'no-candidates',
        initScript: `(() => {
          const original = Element.prototype.querySelectorAll;
          Element.prototype.querySelectorAll = function (selector) {
            if (selector === '[data-collapse]') return document.createDocumentFragment().querySelectorAll('x-none');
            return original.call(this, selector);
          };
        })();`,
      },
    });
    checkSubjectExists([record], failures);
  });

  await requireFailure('instrument-live', async (failures) => {
    // No hydration runtime at all: the measured tier never runs. A proof that
    // still reports "0 wrong frames" here is reporting an absence as a success.
    // `**/*.js` for the same reason the CSS lever is `**/*.css` — naming one
    // subject's entry point makes the lever miss on the other.
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: { label: 'no-runtime', block: ['**/*.js'] },
    });
    checkSubjectExists([record], failures);
    checkInstrumentLive([record], failures);
  });

  await requireFailure('instruments-corroborate', async (failures) => {
    // Aim the pixel differ at a region the subject never occupies. Geometry
    // still sees the defect; the pixel differ reports a clean page. The
    // disagreement must fail, because otherwise a mis-aimed region reads as
    // "no visible flash".
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: { label: 'mis-aimed-region', region: () => ({ x: 0, y: VIEWPORT_HEIGHT - 4, w: 4, h: 4 }) },
    });
    checkInstrumentsCorroborate([record], failures);
  });

  await requireFailure('cls-observable', async (failures) => {
    // The silent-zero trap: make layout-shift unobservable and confirm the
    // proof refuses to read the resulting 0 as a clean page.
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: {
        label: 'cls-blinded',
        initScript: `(() => {
          const original = PerformanceObserver.prototype.observe;
          PerformanceObserver.prototype.observe = function (options) {
            if (options && options.type === 'layout-shift') throw new Error('injected: layout-shift observation refused');
            return original.call(this, options);
          };
        })();`,
      },
    });
    checkClsObservable([record], failures);
  });

  await requireFailure('presolve-eliminates', async (failures) => {
    // A rewrite that touches nothing: the "pre-solved" page IS the shipped
    // page, so claiming pre-solve fixed anything must fail.
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: { label: 'presolve-noop', rewriteHtml: (html) => ({ body: html, sites: 0 }) },
    });
    checkPresolve([record], failures);
  });

  await requireFailure('presolve-eliminates/partial', async (failures) => {
    // A rewrite that pre-solves the CANDIDATES but not the CONTAINERS. The bytes
    // change, `sites` is nonzero, and a naive "did the rewrite do anything"
    // check would pass — so the byte-level container count is what has to fail.
    //
    // The cross-viewport case that used to live here is NOT a counterfactual and
    // was moved out: on this surface the comparison and playground rows spend the
    // same degradations at every measured width, so a recipe captured at 390px is
    // the recipe at 1280px and the crossed cell is legitimately clean. It is a
    // measurement, reported in the main run's CLS table and verdict, and the
    // `presolve-noop` lever above already proves this predicate can fail.
    const settled = await settledSnapshot({ browser, base, route: routes[0], width });
    const recipe = captureRecipe({ width }, settled);
    const partial = presolveRewriter({ ...recipe, containers: recipe.containers.map(() => ({ state: undefined, collapsed: '0' })) });
    const record = await measureFlash({
      browser, decoder, base, route: routes[0], width,
      hooks: {
        label: 'presolve-partial',
        rewriteHtml: (html) => {
          const out = partial(html);
          return { ...out, containersWanted: recipe.containers.filter((c) => c.state).length };
        },
      },
    });
    checkPresolve([record], failures);
  });

  await requireFailure('calibration', async (failures) => {
    // A defect of zero magnitude: the instrument must not recover the magnitude
    // it was told to expect.
    await runCalibration({ browser, decoder, failures, expectDefectPx: 0 });
  });

  console.log('\nself-test OK: every assertion path was observed failing under its own counterfactual.');
}

// ══════════════════════════════════════════════════════════════════════════
// THE FULL REPORT
// ══════════════════════════════════════════════════════════════════════════
// One path, used by both subjects, so the fixture and the built site can never
// be measured by two drifting instruments.
async function runFullReport({ browser, decoder, base, routes, widths, failures, subject, inertness }) {
  console.log(`\n══ SUBJECT: ${subject} ══`);

  await runCalibration({ browser, decoder, failures });

  console.log("\n── Q1: the static tier, with the page's own scripts DISABLED ─────────");
  const statics = [];
  for (const route of routes) for (const context of CONTEXTS) statics.push(await measureStaticTier({ browser, base, route, context }));
  const { checked, unrendered } = checkStaticTier(statics, failures, { minReadings: routes.length * CONTEXTS.length * 3 });
  console.log(
    `  measured: ${routes.length} route(s) x ${CONTEXTS.length} context(s) = ${statics.length} page loads, ` +
      `${statics.reduce((n, s) => n + s.readings.length, 0)} element reads, ${checked} closed-form assertions, ` +
      `${unrendered} element(s) skipped as unrendered (the table hiding an unrevealed overflow trigger), ` +
      `${statics.reduce((n, s) => n + s.declaredContainers, 0)} declared fit container(s), ` +
      `${statics.reduce((n, s) => n + s.solvedCount, 0)} engine-written attribute(s) present (must be 0)`,
  );

  console.log('\n── Q2/Q3: the flash of unfit, two instruments ────────────────────────');
  const { flashRecords, presolveMatched, presolveCrossed } = await runSubject({ browser, decoder, base, routes, widths, failures });

  if (inertness) {
    console.log('\n── the inertness measurement (unlayered states.css + universal token rule) ──');
    const inert = await measureInertness({ browser, base, intentRoute: routes[0] });
    console.log(
      `  REACH — ${inert.controlRoute} links [${inert.controlSheets.join(', ')}] and ` +
        `${inert.controlCarriesTheme ? 'DOES carry intent selectors: the hazard is live on non-intent pages' : 'carries no intent selector at all: the hazard cannot reach non-intent pages'}`,
    );
    console.log(
      `  CO-RESIDENCE — ${inert.intentRoute}: ${inert.chromeElementsRead} Tailwind-authored chrome element(s) read (class-bearing, outside every island), ` +
        `of which ${inert.collisionSurface} already spell an attribute intent selects on and ${inert.ancestorsOfIslands} contain an island ` +
        `(compared on intrinsic properties only); ${inert.rulesRemoved} intent rule(s) deleted from the live sheets, ${inert.moved} chrome element(s) changed. ` +
        `${inert.moved === 0 ? 'Measured inert.' : `NOT inert:\n      ${inert.examples.join('\n      ')}`}`,
    );
    if (inert.rulesRemoved === 0) {
      failures.push(new Error('inertness: 0 intent rules were removable from the live sheets — the measurement had nothing to switch off, so its 0 is vacuous'));
    }
    if (inert.chromeElementsRead === 0) {
      failures.push(new Error(`inertness: 0 site-chrome elements found on ${inert.intentRoute} — the co-residence measurement had nothing to compare, so its 0 is vacuous`));
    }
    if (inert.moved > 0) {
      failures.push(
        new Error(
          `inertness: intent changed ${inert.moved} site-chrome element(s) on ${inert.intentRoute} that declare nothing of its vocabulary. ` +
            `First: ${inert.examples[0]}`,
        ),
      );
    }
  }

  console.log('\n── Q3 verdict: is CLS a usable oracle here? ──────────────────────────');
  const { rows, blindSpots, falsePositives } = clsVerdict([...flashRecords.filter((r) => r.sample), ...presolveMatched, ...presolveCrossed]);
  for (const row of rows) console.log(`  ${row.label.padEnd(56)} defect=${String(row.defect).padEnd(5)} visible=${String(row.visible).padEnd(5)} CLS=${row.cls}`);
  console.log(
    `  CLS blind spots (visibly wrong, CLS 0): ${blindSpots.length}/${rows.length}. ` +
      `CLS false positives (nothing wrong, CLS > 0): ${falsePositives.length}/${rows.length}.`,
  );
  console.log(
    blindSpots.length || falsePositives.length
      ? '  → CLS is NOT a usable oracle on this surface. Trusted instead: composited-frame diff corroborated by geometry.'
      : '  → CLS agreed with the trusted instruments on every measured cell here.',
  );

  console.log('\n── verdict ───────────────────────────────────────────────────────────');
  const shipped = flashRecords.filter((r) => r.sample && r.mode === 'as-shipped');
  const worst = shipped.reduce((a, b) => ((b.compositedWrongMs ?? 0) > (a?.compositedWrongMs ?? -1) ? b : a), undefined);
  const presolveClean = presolveMatched.length > 0 && presolveMatched.every((r) => r.compositedWrongStates === 0 && r.rewriteSites > 0);
  const crossedClean = presolveCrossed.length > 0 && presolveCrossed.every((r) => r.compositedWrongStates === 0);
  console.log(`  Q1 static tier, script execution disabled: ${checked} closed-form values correct across ${CONTEXTS.length} contexts`);
  console.log(
    `  Q2 worst as-shipped flash: ${
      worst
        ? `${worst.route} ${worst.width}px — ${worst.compositedWrongStates} wrong paint(s), ${worst.compositedWrongMs}ms on screen ≈ ${worst.compositedWrongFrames} frame(s), ` +
          `${worst.worstVisibleExtentPx}px visible, ${worst.maxDisplacementPx}px geometric`
        : 'none measured'
    }`,
  );
  console.log(`  Q2 naive rAF over-report: ${shipped.map((r) => `${r.naiveUnfitFrames}→${r.compositedWrongFrames}`).join(' ')} (naive frames → composited frames)`);
  console.log(
    `  SSG pre-solve simulated: matched-viewport ${presolveClean ? 'ELIMINATES the flash' : 'does NOT eliminate the flash'}; ` +
      `cross-viewport ${crossedClean ? 'also clean' : 'REINTRODUCES it'}` +
      `${presolveMatched.some((r) => r.regressedFromSolved > 0) ? '; a solved container REGRESSED to unsolved (replace-mount discards pre-solved bytes)' : ''}`,
  );
  return { checked, flashRecords, presolveMatched, presolveCrossed };
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
let browser;
let decoder;
let server;
let staging;
let primary;
const failures = [];
try {
  const widths = value('widths', '') ? value('widths', '').split(',').map(Number) : WIDTHS;
  const routes = value('route', '') ? [value('route', '')] : ROUTES;

  browser = await chromium.launch();
  decoder = await openDecoder(browser);

  if (has('calibrate')) {
    await runCalibration({ browser, decoder, failures });
  } else {
    // Subject selection is shared by the report and the self-test, so a lever
    // proven against one subject is proven against the instrument, not against
    // a mode. `--fixture` is the self-contained subject; the default is dist/.
    let subject;
    let subjectRoutes;
    let inertness;
    if (has('fixture')) {
      const started = await startServer({ routes: await buildFixture({ hydrationDelayMs: Number(value('delay', '80')) }) });
      server = started.server;
      subject = 'self-contained fixture — the shipped theme table off disk, the shipped fit() bundled in memory, a controlled hydration delay';
      subjectRoutes = ['/fixture/'];
      inertness = false;
    } else {
      const built = await requireBuiltSite(routes);
      staging = built.root;
      const started = await startServer({ root: built.root });
      server = started.server;
      subject =
        `the built site — a staged snapshot of dist/ (${built.tree.files} files, ${built.tree.bytes} bytes), ` +
        `stylesheets [${built.sheets.join(', ')}] totalling ${built.cssBytes} bytes`;
      subjectRoutes = routes;
      inertness = true;
    }
    const base = `http://127.0.0.1:${server.address().port}`;
    if (has('self-test')) {
      console.log(`\n══ SELF-TEST SUBJECT: ${subject} ══`);
      await runSelfTest({ browser, decoder, base, routes: subjectRoutes, width: Math.min(...widths) });
    } else {
      await runFullReport({ browser, decoder, base, routes: subjectRoutes, widths, failures, subject, inertness });
    }
  }
} catch (error) {
  primary = error;
  throw error;
} finally {
  try {
    await decoder?.close();
  } catch {
    /* the cleanup contract below owns surfacing */
  }
  try {
    if (staging) await rm(staging, { recursive: true, force: true });
  } catch {
    /* the cleanup contract below owns surfacing */
  }
  await cleanupResources({ browser, server, primary });
}

if (failures.length) throw new AggregateError(failures, `intent SSG pre-solve proof failed (${failures.length} assertion(s))`);
console.log('\nintent SSG pre-solve proof OK');
