import { chromium } from 'playwright';

const URL = 'http://127.0.0.1:5199';
const PAGES = ['inbox', 'settings', 'data', 'marketing'];
const DENSITIES = ['comfortable', 'compact', 'dense'];
const INPUTS = ['pointer', 'touch'];
const THEMES = ['light', 'dark'];
const WIDTHS = [1080, 720, 480, 360, 320];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__c11?.settled === 'function');
await page.evaluate(() => window.__c11.settled());

const rows = [];
for (const p of PAGES)
  for (const d of DENSITIES)
    for (const i of INPUTS)
      for (const t of THEMES)
        for (const w of WIDTHS) {
          const ctx = { page: p, density: d, input: i, theme: t, width: w };
          await page.evaluate(async (c) => {
            window.__c11.setContext(c);
            await window.__c11.settled();
          }, ctx);
          const out = await page.evaluate(() => {
            const api = window.__c11;
            const seen = [];
            api.sweepOverlays(api.canvas, ({ panel }) => {
              if (!panel) return;
              const bound = getComputedStyle(panel).maxInlineSize;
              const got = panel.getBoundingClientRect().width;
              // Was the bound BINDING? Lift it and see whether the panel grows.
              const was = panel.getAttribute('style');
              panel.style.maxInlineSize = 'none';
              const free = panel.getBoundingClientRect().width;
              if (was === null) panel.removeAttribute('style');
              else panel.setAttribute('style', was);
              // line boxes per text node, at the real bound
              let worst = 0;
              const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
              for (let n = walker.nextNode(); n; n = walker.nextNode()) {
                const txt = (n.nodeValue ?? '').trim();
                if (!txt) continue;
                const r = document.createRange();
                r.selectNodeContents(n);
                worst = Math.max(worst, r.getClientRects().length - txt.split(/\s+/).length);
              }
              seen.push({ bound, got: +got.toFixed(1), free: +free.toFixed(1), worst });
            });
            return seen;
          });
          for (const s of out) rows.push({ label: `${p}/${d}/${i}/${t}/${w}`, ...s });
        }
await browser.close();

const binding = rows.filter((r) => r.free > r.got + 0.5);
console.log(`overlays opened: ${rows.length}`);
console.log(`max-inline-size was BINDING in: ${binding.length}`);
for (const b of binding.slice(0, 12)) console.log('   ', b.label, JSON.stringify(b));
const headroom = rows.map((r) => +(r.got - r.free).toFixed(1));
console.log('slack (got - unbounded), min/max:', Math.min(...headroom), Math.max(...headroom));
console.log('worst (lineBoxes - words) over all text nodes:', Math.max(...rows.map((r) => r.worst)));
const bounds = [...new Set(rows.map((r) => r.bound))];
console.log('distinct resolved max-inline-size values:', bounds.join(' | '));
