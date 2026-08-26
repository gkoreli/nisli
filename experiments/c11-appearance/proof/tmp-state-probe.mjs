import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://127.0.0.1:5199', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__c11?.settled === 'function');

async function shot(ctx, file, probe) {
  await page.evaluate(async (c) => {
    window.__c11.setContext(c);
    await window.__c11.settled();
  }, ctx);
  const out = await page.evaluate(probe);
  await page.locator('#viewport').screenshot({ path: file });
  console.log(JSON.stringify({ ctx, out }, null, 2));
}

// 1. inbox hostile, dense/320 — the N620 + N710 claim
await shot(
  { page: 'inbox', state: 'hostile', density: 'dense', input: 'pointer', theme: 'light', width: 320 },
  '/tmp/c11-inbox-hostile-320.png',
  () => {
    const canvas = document.getElementById('canvas');
    return [...canvas.querySelectorAll('[data-fit]')].map((el) => {
      const author = el.querySelector('[data-text="title"]');
      return {
        fit: el.getAttribute('data-fit'),
        client: el.clientWidth,
        scroll: el.scrollWidth,
        collapsed: el.querySelectorAll('[data-collapsed]').length,
        author: author && {
          text: (author.textContent ?? '').slice(0, 24),
          truncate: author.hasAttribute('data-truncate'),
          rect: Math.round(author.getBoundingClientRect().width),
          scroll: author.scrollWidth,
          whiteSpace: getComputedStyle(author).whiteSpace,
          overflowWrap: getComputedStyle(author).overflowWrap,
          textOverflow: getComputedStyle(author).textOverflow,
        },
      };
    });
  },
);

// 2. settings hostile at 1080 — the N690 label claim
await shot(
  { page: 'settings', state: 'hostile', density: 'comfortable', input: 'pointer', theme: 'light', width: 1080 },
  '/tmp/c11-settings-hostile-1080.png',
  () => {
    const canvas = document.getElementById('canvas');
    return [...canvas.querySelectorAll('label[data-text="label"]')].map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent ?? '').slice(0, 30),
        rect: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
        lineHeight: cs.lineHeight,
        overflowWrap: cs.overflowWrap,
        scroll: el.scrollWidth,
        client: el.clientWidth,
      };
    });
  },
);

// 3. marketing hostile at dense/320 — the display-text N690 claim
await shot(
  { page: 'marketing', state: 'hostile', density: 'dense', input: 'pointer', theme: 'light', width: 320 },
  '/tmp/c11-marketing-hostile-320.png',
  () => {
    const el = document.getElementById('canvas').querySelector('[data-text="display"]');
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent ?? '').slice(0, 30),
      rect: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      overflowWrap: cs.overflowWrap,
    };
  },
);

// 4. the contentless states, for the visual record
for (const state of ['loading', 'error', 'empty']) {
  await shot(
    { page: 'inbox', state, density: 'comfortable', input: 'pointer', theme: 'light', width: 720 },
    `/tmp/c11-inbox-${state}-720.png`,
    () => {
      const canvas = document.getElementById('canvas');
      const live = canvas.querySelector('[role="status"], [role="alert"]');
      return {
        live: live?.getAttribute('role') ?? null,
        text: (canvas.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      };
    },
  );
}

await browser.close();
