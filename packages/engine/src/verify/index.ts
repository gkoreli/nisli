/**
 * verify({ baseUrl, routes, widths }) — the browser half of the Proof context.
 *
 * `prove()` (`@nisli/engine/test`) proves a screen in happy-dom with an
 * estimating measurer; this loads the running app in real Chromium at each
 * route and width and reads the evidence the engine leaves behind in dev
 * plus what only a layout engine can tell:
 *
 *   - the evidence is there at all: `window.__nisli` exists (the engine in
 *     dev); a production build has none and is `NO_EVIDENCE`, never `ok`
 *   - the screen finished loading: no `[role=status][aria-label="Loading"]`
 *     skeleton and no `[aria-busy="true"]` within `timeout` (`STILL_LOADING`)
 *   - zero console errors and page errors (minus `ignore`), through the
 *     keyboard pass included
 *   - zero `[data-nisli-error]` (a block whose setup failed — core's stamp)
 *   - zero `[data-nisli-report]` (a plan the engine could not satisfy — the
 *     engine's stamp; `window.__nisli.reports` carries the detail)
 *   - no horizontal scroll (`scrollWidth > clientWidth` on the document)
 *   - every visible button, link and input has an accessible name
 *   - Tab from the body reaches at least one control
 *   - when a `[role=dialog]` is open at load (a route that opens one, or one
 *     `open` clicks into), Tab never leaves it
 *
 * Playwright is loaded on demand (`import('playwright')`): it is an optional
 * peer for development, never a dependency of the engine. The result is data;
 * `result.ok` is the exit code. `bin/nisli-verify.mjs` is the CLI.
 */

export type FindingCode =
  | 'CONSOLE_ERROR'
  | 'PAGE_ERROR'
  | 'BLOCK_ERROR'
  | 'LAYOUT_REPORT'
  | 'HORIZONTAL_SCROLL'
  | 'NAME_MISSING'
  | 'TAB_UNREACHABLE'
  | 'TAB_ESCAPED_DIALOG'
  | 'NO_EVIDENCE'
  | 'STILL_LOADING'
  | 'LOAD_FAILED';

export interface Finding {
  readonly route: string;
  readonly width: number;
  readonly code: FindingCode;
  readonly detail: string;
}

export interface VerifyOptions {
  /** Where the app is served, e.g. `http://localhost:5200`. */
  baseUrl: string;
  /** Paths to load, e.g. `['/', '/transactions']`. */
  routes: readonly string[];
  /** Viewport widths to load each route at, e.g. `[1280, 360]`. */
  widths: readonly number[];
  /** Console and page error messages matching any of these are not findings. */
  ignore?: readonly RegExp[];
  /** Viewport height. Default 800. */
  height?: number;
  /** Per-load timeout, ms. Default 15000. */
  timeout?: number;
  /** How long to let the app settle after `load` before reading, ms. Default 250. */
  settle?: number;
  /**
   * Controls to click after the screen has loaded, before the snapshot, so a
   * dialog the route does not open by itself is proven open: `{ route, selector }`,
   * matched by route. The dialog claim is otherwise only checked when one is
   * open at load.
   */
  open?: readonly { route: string; selector: string }[];
}

export interface Result {
  /** True iff there are no findings. */
  readonly ok: boolean;
  readonly findings: readonly Finding[];
  /** Route × width loads made. */
  readonly checked: number;
  /** A compact table: one row per route, one column per width, the finding codes in each cell. */
  readonly table: string;
}

// The slice of Playwright this runner touches, typed here so the engine does not depend on it.
interface ConsoleMessage { type(): string; text(): string }
interface Page {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  waitForSelector(selector: string, options?: { state?: 'attached' | 'detached' | 'visible' | 'hidden'; timeout?: number }): Promise<unknown>;
  click(selector: string, options?: { timeout?: number }): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  on(event: 'console', handler: (m: ConsoleMessage) => void): void;
  on(event: 'pageerror', handler: (e: Error) => void): void;
  keyboard: { press(key: string): Promise<void> };
  close(): Promise<void>;
}
interface Browser { newPage(): Promise<Page>; close(): Promise<void>; version(): string }
interface Playwright { chromium: { launch(options?: { headless?: boolean }): Promise<Browser> } }

/** Playwright from the engine's own resolution, else from the app's working directory (where the dev peer is installed). */
async function loadPlaywright(): Promise<Playwright> {
  const name = 'playwright';
  const unwrap = (mod: Playwright & { default?: Playwright }) => (mod.chromium ? mod : mod.default!);
  try {
    return unwrap((await import(/* @vite-ignore */ name)) as Playwright & { default?: Playwright });
  } catch (first) {
    try {
      const { createRequire } = await import('node:module');
      const { pathToFileURL } = await import('node:url');
      const { join } = await import('node:path');
      const resolved = createRequire(join(process.cwd(), 'package.json')).resolve(name);
      return unwrap((await import(/* @vite-ignore */ pathToFileURL(resolved).href)) as Playwright & { default?: Playwright });
    } catch {
      throw new Error(`@nisli/engine/verify needs playwright (an optional dev peer): install it beside the app, e.g. pnpm add -D playwright && npx playwright install chromium. (${(first as Error).message})`);
    }
  }
}

// ── In-page probes (serialised into the page: no closures over this module) ──

interface Snapshot {
  evidence: boolean;
  blockErrors: string[];
  reports: string[];
  ring: string[];
  scroll: { scrollWidth: number; clientWidth: number };
  unnamed: string[];
  dialogOpen: boolean;
  dialogControls: number;
}

function snapshot(): Snapshot {
  const visible = (el: Element): boolean => {
    if (el.getClientRects().length === 0) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  };
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const name = (el: Element): string => {
    const by = el.getAttribute('aria-labelledby');
    if (by) { const s = by.split(/\s+/).map((id) => text(document.getElementById(id))).filter(Boolean).join(' '); if (s) return s; }
    const label = el.getAttribute('aria-label')?.trim();
    if (label) return label;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      const id = el.getAttribute('id');
      if (id) { const l = text(document.querySelector(`label[for="${CSS.escape(id)}"]`)); if (l) return l; }
      const w = text(el.closest('label')); if (w) return w;
      const type = el.getAttribute('type');
      if (tag === 'INPUT' && (type === 'submit' || type === 'button' || type === 'reset')) { const v = el.getAttribute('value')?.trim(); if (v) return v; }
    } else {
      const c = text(el) || Array.from(el.querySelectorAll('img[alt]')).map((i) => i.getAttribute('alt')?.trim() ?? '').filter(Boolean).join(' ');
      if (c) return c;
    }
    return el.getAttribute('title')?.trim() ?? '';
  };
  const describe = (el: Element) => `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}>` + (el.closest('[data-nisli-action]') ? ` action=${el.getAttribute('data-nisli-action')}` : '');
  const ring = ((window as unknown as { __nisli?: { reports?: { code: string; block: string; detail: string; deficit: number; width: number }[] } }).__nisli?.reports ?? [])
    .map((r) => `${r.code} <${r.block}> ${r.detail} (${Math.round(r.deficit)}px short at ${Math.round(r.width)}px)`);
  const dialog = Array.from(document.querySelectorAll('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]')).find(visible) ?? null;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return {
    evidence: !!(window as unknown as { __nisli?: unknown }).__nisli,
    blockErrors: Array.from(document.querySelectorAll('[data-nisli-error]')).map((el) => `<${el.tagName.toLowerCase()}> ${el.getAttribute('data-nisli-error')}`),
    reports: Array.from(document.querySelectorAll('[data-nisli-report]')).map((el) => `<${el.tagName.toLowerCase()}> ${el.getAttribute('data-nisli-report')}`),
    ring,
    scroll: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    unnamed: Array.from(document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea')).filter((el) => visible(el) && !name(el)).map(describe),
    dialogOpen: !!dialog,
    dialogControls: dialog ? Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(visible).length : 0,
  };
}

/** Where focus is: inside the open dialog, on the body, or elsewhere. */
function focusState(): { onBody: boolean; inDialog: boolean; where: string } {
  const a = document.activeElement;
  const dialog = a?.closest('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]') ?? null;
  return {
    onBody: !a || a === document.body || a === document.documentElement,
    inDialog: !!dialog,
    where: a ? `<${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ''}>` : 'nothing',
  };
}

function blurAll(): void {
  (document.activeElement as HTMLElement | null)?.blur?.();
}

// ── The runner ─────────────────────────────────────────────────────────

/** What a screen still loading looks like: the engine's skeleton, or anything marked busy. */
const LOADING = '[role=status][aria-label="Loading"], [aria-busy="true"]';

export async function verify(options: VerifyOptions): Promise<Result> {
  const { baseUrl, routes, widths, ignore = [], height = 800, timeout = 15000, settle = 250, open = [] } = options;
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch();
  const findings: Finding[] = [];
  const cells = new Map<string, Set<FindingCode>>();
  const cell = (route: string, width: number) => { const k = `${route}@${width}`; let s = cells.get(k); if (!s) cells.set(k, (s = new Set())); return s; };
  const add = (route: string, width: number, code: FindingCode, detail: string) => { findings.push({ route, width, code, detail }); cell(route, width).add(code); };
  const ignored = (msg: string) => ignore.some((re) => re.test(msg));
  let checked = 0;

  try {
    for (const route of routes) {
      for (const width of widths) {
        cell(route, width);
        checked++;
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error' && !ignored(m.text())) errors.push(`console: ${m.text()}`); });
        page.on('pageerror', (e) => { if (!ignored(e.message)) errors.push(`page: ${e.message}`); });
        try {
          await page.setViewportSize({ width, height });
          await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'load', timeout });
          await page.waitForTimeout(settle);
          // The skeleton is not the screen: wait for every loading state to clear.
          let loading = false;
          try { await page.waitForSelector(LOADING, { state: 'hidden', timeout }); }
          catch { loading = true; }
          if (loading) { add(route, width, 'STILL_LOADING', `a loading state (${LOADING}) never cleared within ${timeout}ms`); continue; }
          for (const o of open) if (o.route === route) { await page.click(o.selector, { timeout }); await page.waitForTimeout(settle); }
          const s = await page.evaluate(snapshot);
          if (!s.evidence) add(route, width, 'NO_EVIDENCE', 'window.__nisli is absent: the engine is not in dev mode, so no layout report could have been stamped (a production build proves nothing here)');
          for (const b of s.blockErrors) add(route, width, 'BLOCK_ERROR', b);
          // The latest ring entry for the stamped block carries the detail; an earlier one may since have been satisfied.
          for (const r of s.reports) add(route, width, 'LAYOUT_REPORT', [...s.ring].reverse().find((line: string) => line.includes(r.slice(r.indexOf("<")).split(" ")[0]!)) ?? r);
          if (s.scroll.scrollWidth > s.scroll.clientWidth) add(route, width, 'HORIZONTAL_SCROLL', `document scrolls horizontally: ${s.scroll.scrollWidth}px in ${s.scroll.clientWidth}px`);
          for (const u of s.unnamed) add(route, width, 'NAME_MISSING', `${u} has no accessible name`);

          // Keyboard: Tab from the body reaches a control; inside an open dialog it never leaves.
          await page.evaluate(blurAll);
          await page.keyboard.press('Tab');
          const first = await page.evaluate(focusState);
          if (first.onBody) add(route, width, 'TAB_UNREACHABLE', 'Tab from the body reaches no control');
          if (s.dialogOpen) {
            const presses = s.dialogControls + 2;
            let escaped: string | null = first.inDialog ? null : first.where;
            for (let i = 0; i < presses && !escaped; i++) {
              await page.keyboard.press('Tab');
              const f = await page.evaluate(focusState);
              if (!f.inDialog) escaped = f.where;
            }
            if (escaped) add(route, width, 'TAB_ESCAPED_DIALOG', `Tab left the open dialog to ${escaped}`);
          }
        } catch (e) {
          add(route, width, 'LOAD_FAILED', (e as Error).message.split('\n')[0] ?? String(e));
        } finally {
          // Errors filed at any point — load, snapshot, the keyboard pass — count.
          for (const e of errors) add(route, width, e.startsWith('page:') ? 'PAGE_ERROR' : 'CONSOLE_ERROR', e);
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  return { ok: findings.length === 0, findings, checked, table: table(routes, widths, cells) };
}

/** One row per route, one column per width; `ok` or the finding codes. */
export function table(routes: readonly string[], widths: readonly number[], cells: ReadonlyMap<string, ReadonlySet<FindingCode>>): string {
  const head = ['route', ...widths.map(String)];
  const rows = routes.map((r) => [r, ...widths.map((w) => { const s = cells.get(`${r}@${w}`); return s && s.size ? [...s].join(',') : 'ok'; })]);
  const cols = head.map((_, i) => Math.max(head[i]!.length, ...rows.map((row) => row[i]!.length)));
  const line = (row: readonly string[]) => row.map((c, i) => (i === 0 ? c.padEnd(cols[i]!) : c.padStart(cols[i]!))).join('  ');
  return [line(head), cols.map((n) => '-'.repeat(n)).join('  '), ...rows.map(line)].join('\n');
}

/** Render a result for a terminal: the table, then every finding. */
export function format(result: Result): string {
  const lines = [result.table, ''];
  for (const f of result.findings) lines.push(`${f.route} @ ${f.width}: ${f.code} — ${f.detail}`);
  lines.push(result.ok ? `ok: ${result.checked} loads, no findings` : `${result.findings.length} finding${result.findings.length === 1 ? '' : 's'} over ${result.checked} loads`);
  return lines.join('\n');
}
