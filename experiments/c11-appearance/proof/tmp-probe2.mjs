import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
await page.setContent(`<!doctype html><html><head><style>
  body { margin: 0; --unit: 4px; }
  .clip { position: relative; inline-size: 300px; block-size: 60px; overflow: clip; background: #eee; margin-block-start: 300px; }
  .trig { position: absolute; inset-block-start: 20px; inset-inline-start: 250px; }
  #panel {
    box-sizing: border-box; position: fixed; inset: auto; margin: 0;
    position-area: block-end span-inline-start;
    margin-block-start: var(--unit);
    inline-size: max-content;
    max-inline-size: calc(100dvi - var(--unit) * 2);
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
    position-try-order: most-height;
    max-block-size: stretch;
    overflow: auto;
    padding: var(--unit);
    border: 1px solid #999; background: #fff;
    display: flex; flex-direction: column;
  }
  #panel button { inline-size: 100%; white-space: normal; overflow-wrap: anywhere; text-align: start; }
</style></head><body>
<div class="clip">
  <button class="trig" id="t" command="toggle-popover" commandfor="panel">…</button>
  <div id="panel" popover="auto" role="menu"></div>
</div>
<script>
const panel = document.getElementById('panel');
const LABELS = ['Mark read', 'Archive', 'Reply'];
window.log = [];
panel.addEventListener('beforetoggle', (e) => {
  window.log.push('beforetoggle ' + e.newState);
  if (e.newState !== 'open') return;
  panel.replaceChildren(...LABELS.map((l, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role','menuitem'); b.tabIndex = -1;
    if (i === 0) b.autofocus = true;
    b.textContent = l;
    return b;
  }));
});
panel.addEventListener('toggle', (e) => { window.log.push('toggle ' + e.newState); });
</script>
</body></html>`);

const read = () => page.evaluate(() => {
  const p = document.getElementById('panel');
  const t = document.getElementById('t');
  const c = document.querySelector('.clip');
  const pr = p.getBoundingClientRect(); const tr = t.getBoundingClientRect(); const cr = c.getBoundingClientRect();
  const r1 = (n) => Math.round(n * 10) / 10;
  const labels = [...p.querySelectorAll('[role=menuitem]')].map((b) => {
    const r = document.createRange(); r.selectNodeContents(b.firstChild);
    return [b.textContent, r.getClientRects().length, b.textContent.trim().split(/\s+/).length];
  });
  return {
    log: window.log.slice(), open: p.matches(':popover-open'),
    panel: [r1(pr.x), r1(pr.y), r1(pr.width), r1(pr.height)],
    trigger: [r1(tr.x), r1(tr.y), r1(tr.width), r1(tr.height)],
    clip: [r1(cr.x), r1(cr.y), r1(cr.width), r1(cr.height)],
    gap: r1(Math.max(pr.top - tr.bottom, tr.top - pr.bottom)),
    active: document.activeElement?.textContent?.trim(),
    labels,
    insideClip: pr.top >= cr.top - 1 && pr.bottom <= cr.bottom + 1,
  };
});

// SYNTHETIC click, exactly what sweepOverlays and the unit tests do.
await page.evaluate(() => document.getElementById('t').click());
console.log('after synthetic click →', await read());

// hidePopover() from script: does it restore focus to the invoker?
console.log('hidePopover focus →', await page.evaluate(() => {
  const p = document.getElementById('panel');
  p.hidePopover();
  return { active: document.activeElement?.id || document.activeElement?.tagName, open: p.matches(':popover-open'), log: window.log.slice() };
}));

// Second synthetic click: does the implicit anchor survive a reopen?
await page.evaluate(() => document.getElementById('t').click());
console.log('reopen →', await read());

// A very long unbreakable label against the viewport cap.
await page.evaluate(() => {
  document.getElementById('panel').hidePopover();
  window.LONGER = true;
  const p = document.getElementById('panel');
  p.addEventListener('beforetoggle', (e) => {
    if (e.newState !== 'open') return;
    queueMicrotask(() => {});
    const b = document.createElement('button');
    b.type='button'; b.setAttribute('role','menuitem'); b.tabIndex=-1;
    b.textContent = 'Unsubscribe from absolutely everything immediately';
    p.append(b);
  });
});
await page.evaluate(() => document.getElementById('t').click());
console.log('long label →', await read());

await browser.close();
