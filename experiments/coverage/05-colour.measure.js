/*
 * Measurement harness for experiments/coverage/05-colour.html.
 * Injected with page.evaluate() by the browser tool; NOT part of the fixture,
 * so the fixture stays pure HTML+CSS and cannot lie about what it painted.
 *
 * Every colour is resolved to sRGB by painting it on a 1x1 canvas, because a
 * derived table's computed values come back as oklab()/color-mix() and the only
 * honest answer to "what did the user see" is what the compositor produced.
 */
(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();

  /** Resolve any CSS colour string to [r,g,b,a] in 0..1 as painted. */
  function srgb(str) {
    if (cache.has(str)) return cache.get(str);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = str;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const a = d[3] / 255;
    const out = a === 0 ? [0, 0, 0, 0]
      : [Math.min(1, d[0] / 255 / a), Math.min(1, d[1] / 255 / a), Math.min(1, d[2] / 255 / a), a];
    cache.set(str, out);
    return out;
  }

  const over = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]),
                          f[2] * f[3] + b[2] * (1 - f[3]), 1];

  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const relLum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  function wcag(fg, bg) {
    const a = relLum(fg), b = relLum(bg);
    const hi = a > b ? a : b, lo = a > b ? b : a;
    return (hi + 0.05) / (lo + 0.05);
  }

  /* APCA 0.1.9 / W3-0.1.17 constants (Myndex/SAPC-APCA) */
  const Yc = (c) => 0.2126729 * c[0] ** 2.4 + 0.7151522 * c[1] ** 2.4 + 0.072175 * c[2] ** 2.4;
  function apca(txt, bg) {
    const B = 0.022, C = 1.414;
    let ty = Yc(txt), by = Yc(bg);
    ty = ty > B ? ty : ty + (B - ty) ** C;
    by = by > B ? by : by + (B - by) ** C;
    if (Math.abs(by - ty) < 0.0005) return 0;
    let out;
    if (by > ty) {
      const s = (by ** 0.56 - ty ** 0.57) * 1.14;
      out = s < 0.1 ? 0 : s - 0.027;
    } else {
      const s = (by ** 0.65 - ty ** 0.62) * 1.14;
      out = s > -0.1 ? 0 : s + 0.027;
    }
    return out * 100;
  }

  function Lstar(c) {
    const y = relLum(c);
    return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  }

  const hex = (c) => '#' + [0, 1, 2].map((i) => Math.round(c[i] * 255).toString(16).padStart(2, '0')).join('');

  /** nearest painted backdrop, composited, per the c11 inspector.backdrop rule */
  function backdrop(el) {
    const stack = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const c = srgb(getComputedStyle(node).backgroundColor);
      if (c[3] > 0) { stack.push(c); if (c[3] === 1) break; }
      node = node.parentElement;
    }
    let acc = [1, 1, 1, 1];
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  }

  function effOpacity(el) {
    let o = 1, node = el;
    while (node && node.nodeType === 1) {
      const v = parseFloat(getComputedStyle(node).opacity);
      if (!Number.isNaN(v)) o *= v;
      node = node.parentElement;
    }
    return o;
  }

  const NONTEXT = new Set(['surface', 'ring', 'check', 'shadow']);

  const rows = [];
  for (const el of document.querySelectorAll('[data-cell]')) {
    const [mode, theme, elev, p] = el.dataset.cell.split('/');
    const cs = getComputedStyle(el);
    const fgRaw = cs.color;
    const bdRaw = cs.backgroundColor;
    const bd = backdrop(el);
    const fg = srgb(fgRaw);
    const op = effOpacity(el);
    const fgEff = over([fg[0], fg[1], fg[2], fg[3] * op], bd);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight);
    const large = size >= 18.66 || (size >= 14 && weight >= 700);
    rows.push({
      mode, theme, elev: +elev, p, texty: !NONTEXT.has(p),
      fg: hex(fg), fgRaw, bd: hex(bd), bdRaw, bdAlpha: srgb(bdRaw)[3],
      border: hex(srgb(cs.borderTopColor)),
      outline: hex(srgb(cs.outlineColor)), outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle,
      shadow: cs.boxShadow, accentColor: cs.accentColor, forcedAdjust: cs.forcedColorAdjust,
      opacity: op, size, weight, large, floor: large ? 3 : 4.5,
      wcag: +wcag(fgEff, bd).toFixed(2),
      wcagNoOpacity: +wcag(over(fg, bd), bd).toFixed(2),
      apca: +apca(fgEff, bd).toFixed(1),
    });
  }

  /* surface-to-surface steps: is nesting-derived elevation visible at all? */
  const steps = [];
  for (const mode of ['authored', 'derived', 'derived2']) {
    for (const theme of ['light', 'dark']) {
      const surf = [];
      for (let k = 0; k <= 8; k++) {
        const el = document.querySelector(`[data-mode=${mode}][data-theme=${theme}] [data-elev="${k}"]`);
        const cs = getComputedStyle(el);
        surf.push({ k, bg: srgb(cs.backgroundColor), bgRaw: cs.backgroundColor, line: srgb(cs.borderTopColor) });
      }
      for (let k = 0; k < 8; k++) {
        const a = surf[k].bg, b = surf[k + 1].bg;
        steps.push({
          mode, theme, pair: `${k}->${k + 1}`, from: hex(a), to: hex(b),
          wcag: +wcag(a, b).toFixed(3), apca: +apca(b, a).toFixed(1),
          dL: +(Lstar(b) - Lstar(a)).toFixed(2),
          lineVsSurface: +wcag(surf[k + 1].line, surf[k].bg).toFixed(2),
          lineApca: +apca(surf[k + 1].line, surf[k].bg).toFixed(1),
        });
      }
    }
  }

  /* non-text: focus ring and surface border against their own backdrop */
  const nontext = [];
  for (const el of document.querySelectorAll('[data-p=ring],[data-surface]')) {
    const [mode, theme, elev, p] = el.dataset.cell.split('/');
    const cs = getComputedStyle(el);
    const parentBd = backdrop(el.parentElement);
    const ownBd = backdrop(el);
    const ring = srgb(cs.outlineColor);
    if (p === 'ring') {
      nontext.push({ mode, theme, elev: +elev, what: 'ring-vs-own-bg', colour: hex(ring),
        against: hex(ownBd), wcag: +wcag(ring, ownBd).toFixed(2), apca: +apca(ring, ownBd).toFixed(1) });
      nontext.push({ mode, theme, elev: +elev, what: 'ring-vs-gap', colour: hex(ring),
        against: hex(parentBd), wcag: +wcag(ring, parentBd).toFixed(2), apca: +apca(ring, parentBd).toFixed(1) });
    } else {
      const b = srgb(cs.borderTopColor);
      nontext.push({ mode, theme, elev: +elev, what: 'surface-border', colour: hex(b),
        against: hex(parentBd), wcag: +wcag(b, parentBd).toFixed(2), apca: +apca(b, parentBd).toFixed(1) });
    }
  }

  /* RAMP SWEEP — 41 unclamped 1% elevation steps: where does the ramp die? */
  const ramp = [];
  for (const theme of ['light', 'dark']) {
    let prev = null;
    for (let k = 0; k <= 40; k++) {
      const host = document.querySelector(`#ramp [data-ramp="${theme}/${k}"]`);
      const hs = getComputedStyle(host);
      const surface = srgb(hs.backgroundColor);
      const rec = { theme, k, surface: hex(surface), line: hex(srgb(hs.borderTopColor)),
        lineWcag: +wcag(srgb(hs.borderTopColor), surface).toFixed(2),
        stepWcag: prev ? +wcag(surface, prev).toFixed(3) : null,
        stepDL: prev ? +(Lstar(surface) - Lstar(prev)).toFixed(2) : null,
        stepApca: prev ? +apca(surface, prev).toFixed(1) : null };
      for (const rp of ['body', 'meta', 'link']) {
        const el = document.querySelector(`#ramp [data-ramp="${theme}/${k}/${rp}"]`);
        const c = srgb(getComputedStyle(el).color);
        rec[rp] = hex(c);
        rec[rp + 'Wcag'] = +wcag(c, surface).toFixed(2);
        rec[rp + 'Apca'] = +apca(c, surface).toFixed(1);
      }
      const ringEl = document.querySelector(`#ramp [data-ramp="${theme}/${k}/ring"]`);
      const rc = srgb(getComputedStyle(ringEl).outlineColor);
      rec.ring = hex(rc);
      rec.ringWcag = +wcag(rc, surface).toFixed(2);
      ramp.push(rec);
      prev = surface;
    }
  }

  /* GAMUT SWEEP — 729 sRGB surfaces under contrast-color(): is there a floor? */
  let gmin = Infinity, gminAt = null, gminApca = Infinity, gminApcaAt = null;
  let gBlack = 0, gWhite = 0, gBelow45 = 0, gBelowLc60 = 0, gBelowLc75 = 0;
  const gDist = [];
  for (const el of document.querySelectorAll('#gamut .sw')) {
    const cs = getComputedStyle(el);
    const bg = srgb(cs.backgroundColor);
    const fg = srgb(cs.color);
    const w = wcag(fg, bg);
    const a = Math.abs(apca(fg, bg));
    if (w < gmin) { gmin = w; gminAt = { sw: el.dataset.sw, fg: hex(fg) }; }
    if (a < gminApca) { gminApca = a; gminApcaAt = { sw: el.dataset.sw, fg: hex(fg) }; }
    if (fg[0] < 0.5) gBlack++; else gWhite++;
    if (w < 4.5) gBelow45++;
    if (a < 60) gBelowLc60++;
    if (a < 75) gBelowLc75++;
    gDist.push({ sw: el.dataset.sw, fg: hex(fg), w: +w.toFixed(2), a: +a.toFixed(1) });
  }
  const gamut = {
    n: gDist.length, minWcag: +gmin.toFixed(3), minWcagAt: gminAt,
    minApcaLc: +gminApca.toFixed(1), minApcaAt: gminApcaAt,
    pickedBlack: gBlack, pickedWhite: gWhite,
    below45: gBelow45, belowLc60: gBelowLc60, belowLc75: gBelowLc75,
    worst20: gDist.sort((x, y) => x.w - y.w).slice(0, 20),
  };

  /* how would the c11 checker's own parser fare on these computed strings? */
  function c11channels(colour) {
    const nums = (colour.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (nums.length < 3) return null;
    if (colour.startsWith('color(')) return colour.includes('srgb') ? [nums[0], nums[1], nums[2]] : null;
    if (!colour.startsWith('rgb')) return null;
    if (nums[3] !== undefined && nums[3] < 1) return null;
    return [nums[0], nums[1], nums[2]];
  }
  const parserAudit = { total: 0, undecidable: 0, byMode: {} };
  for (const r of rows) {
    if (!r.texty) continue;
    parserAudit.total++;
    const key = `${r.mode}/${r.theme}`;
    parserAudit.byMode[key] ??= { total: 0, undecidable: 0, samples: [] };
    parserAudit.byMode[key].total++;
    if (!c11channels(r.fgRaw)) {
      parserAudit.undecidable++;
      parserAudit.byMode[key].undecidable++;
      if (parserAudit.byMode[key].samples.length < 2)
        parserAudit.byMode[key].samples.push(`${r.p}: ${r.fgRaw}`);
    }
  }

  const gates = {};
  for (const el of document.querySelectorAll('i[data-gate]'))
    gates[el.dataset.gate] = getComputedStyle(el).getPropertyValue('--ok').trim();

  const misc = [];
  for (const mode of ['authored', 'derived', 'derived2']) {
    for (const theme of ['light', 'dark']) {
      const q = (sel) => document.querySelector(`[data-mode=${mode}][data-theme=${theme}] ${sel}`);
      const sel = q('[data-p=sel]'), chk = q('[data-p=check]'), shd = q('[data-p=shadow]');
      const ph = q('[data-p=placeholder]');
      misc.push({ mode, theme,
        selectionBg: getComputedStyle(sel, '::selection').backgroundColor,
        selectionFg: getComputedStyle(sel, '::selection').color,
        placeholderFg: getComputedStyle(ph, '::placeholder').color,
        accentColor: getComputedStyle(chk).accentColor,
        colorScheme: getComputedStyle(document.querySelector(`[data-mode=${mode}][data-theme=${theme}]`)).colorScheme,
        boxShadow: getComputedStyle(shd).boxShadow,
        forcedAdjust: getComputedStyle(shd).forcedColorAdjust,
      });
    }
  }

  /* system colour keywords, as the UA resolves them right now */
  const sys = {};
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  for (const k of ['Canvas','CanvasText','LinkText','VisitedText','ActiveText','ButtonFace',
                   'ButtonText','ButtonBorder','Field','FieldText','Highlight','HighlightText',
                   'SelectedItem','SelectedItemText','Mark','MarkText','GrayText','AccentColor',
                   'AccentColorText']) {
    probe.style.color = '';
    probe.style.color = k;
    sys[k] = getComputedStyle(probe).color;
  }
  probe.remove();

  return { rows, steps, nontext, ramp, gamut, parserAudit, gates, misc, sys,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    prefersContrastMore: matchMedia('(prefers-contrast: more)').matches,
    prefersContrastLess: matchMedia('(prefers-contrast: less)').matches,
    prefersContrastCustom: matchMedia('(prefers-contrast: custom)').matches,
    prefersSchemeDark: matchMedia('(prefers-color-scheme: dark)').matches,
    invertedColors: matchMedia('(inverted-colors: inverted)').matches };
})()
