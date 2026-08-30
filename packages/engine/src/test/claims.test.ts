/**
 * Every claim checker on a positive fixture (holds: no claim) and a negative
 * one (fails: exactly the claim), over plain DOM in happy-dom.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkers, claimsOf, accessibleName, reportClaim, overflowText, accessibleNames, uniqueIds, formLabels, dialogAria, menuItems, blockErrors, reachable, sortReachable, popupAria, liveTone, type Checker } from './claims.js';
import { estimator } from './estimate.js';

beforeEach(() => { document.body.innerHTML = ''; });

const fixture = (html: string, width = 400): HTMLElement => {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.style.width = `${width}px`;
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
};
const codes = (c: Checker, root: HTMLElement, width = 400) => c.check(root, estimator(width)).map((x) => x.code);

describe('claim checkers', () => {
  it('OVERFLOW_TEXT: a nowrap text wider than its box with no ellipsis fails; with an ellipsis, wrapping, or room it holds', () => {
    // 'Grandmother’s lasagne al forno' is ~196px at 14px; the box is 120.
    expect(codes(overflowText, fixture('<h2 style="white-space:nowrap">Grandmother’s lasagne al forno</h2>', 120))).toEqual(['OVERFLOW_TEXT']);
    expect(codes(overflowText, fixture('<h2 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Grandmother’s lasagne al forno</h2>', 120))).toEqual([]);
    expect(codes(overflowText, fixture('<h2>Grandmother’s lasagne al forno</h2>', 120))).toEqual([]);                      // wraps
    expect(codes(overflowText, fixture('<h2 style="white-space:nowrap">Grandmother’s lasagne al forno</h2>', 400))).toEqual([]);  // room
    expect(codes(overflowText, fixture('<div style="display:none"><h2 style="white-space:nowrap">Grandmother’s lasagne al forno</h2></div>', 120))).toEqual([]);  // hidden
    // A button's inline padding counts, and the skin's font size is read from the inline style.
    expect(codes(overflowText, fixture('<button style="white-space:nowrap;padding:0 12px;font-size:16px;font-weight:600">Save recipe</button>', 100))).toEqual(['OVERFLOW_TEXT']);
    expect(codes(overflowText, fixture('<button style="white-space:nowrap;padding:0 12px">Save recipe</button>', 100))).toEqual([]);
    const claim = overflowText.check(fixture('<nisli-toolbar><h2 style="white-space:nowrap">Grandmother’s lasagne al forno</h2></nisli-toolbar>', 120), estimator(120))[0]!;
    expect(claim.block).toBe('nisli-toolbar');
    expect(claim.severity).toBe('error');
    expect(claim.detail).toMatch(/needs \d+px in 120px/);
  });

  it('FIGURE_TRUNCATED: a tabular figure under an ellipsis that would lose digits fails; a text under an ellipsis, or a figure with room, holds', () => {
    // '$1,234,567,890.00' in tabular 14px is ~150px; the cell pins 80.
    const cell = (style: string, value: string, width = 400) => fixture(`<table><tbody><tr><td style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:80px;${style}">${value}</td></tr></tbody></table>`, width);
    expect(codes(overflowText, cell('font-variant-numeric:tabular-nums', '$1,234,567,890.00'))).toEqual(['FIGURE_TRUNCATED']);
    expect(codes(overflowText, cell('font-variant-numeric:tabular-nums', '$12.00'))).toEqual([]);                          // room
    expect(codes(overflowText, cell('', 'Whole Foods Market #10235 on Mission Street'))).toEqual([]);                    // a text may truncate
    expect(codes(overflowText, cell('font-variant-numeric:tabular-nums', 'Grandmother’s lasagne al forno'))).toEqual([]); // tabular but no digit: a text
    // A Stat's value: a one-line div (nowrap) under text.display, tabular, in a grid cell too narrow for it.
    const stat = fixture('<nisli-grid style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:16px"><nisli-stat><div style="font-size:28px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">$1,234,567,890.00</div></nisli-stat></nisli-grid>', 400);
    const claim = overflowText.check(stat, estimator(400))[0]!;
    expect(claim.code).toBe('FIGURE_TRUNCATED');
    expect(claim.block).toBe('nisli-stat');
    expect(claim.detail).toMatch(/is a figure under an ellipsis: needs \d+px in 88px/);
    // The App's brand is a one-line div too: inspected as text, with no ellipsis it is OVERFLOW_TEXT.
    expect(codes(overflowText, fixture('<div style="white-space:nowrap;font-size:16px;font-weight:600">A brand name far too long for its sidebar</div>', 100))).toEqual(['OVERFLOW_TEXT']);
    expect(codes(overflowText, fixture('<div style="font-size:16px;font-weight:600">A brand name far too long for its sidebar</div>', 100))).toEqual([]); // a wrapping div is not text
  });

  it('NAME_MISSING: a control with no name fails; text, aria-label, aria-labelledby, a label, a title, alt or a value hold', () => {
    expect(codes(accessibleNames, fixture('<button></button>'))).toEqual(['NAME_MISSING']);
    expect(codes(accessibleNames, fixture('<a href="/x"></a>'))).toEqual(['NAME_MISSING']);
    expect(codes(accessibleNames, fixture('<input id="q">'))).toEqual(['NAME_MISSING']);
    expect(codes(accessibleNames, fixture('<button>⋯</button><button aria-label="More"></button><span id="n">Name</span><button aria-labelledby="n"></button><button title="Hint"></button><button><img alt="Close"></button>'))).toEqual([]);
    expect(codes(accessibleNames, fixture('<label for="q">Query</label><input id="q"><label>Wrapped <input></label><input type="submit" value="Go"><input type="hidden">'))).toEqual([]);
    expect(codes(accessibleNames, fixture('<div style="display:none"><button></button></div>'))).toEqual([]);
    expect(accessibleName(fixture('<button aria-labelledby="missing x"><span id="x">Fallback</span></button>').firstElementChild!)).toBe('Fallback');
  });

  it('NAME_MISSING (widened): a focusable non-native element needs a name from its author — cell text is content, not a name', () => {
    expect(codes(accessibleNames, fixture('<table><tbody><tr tabindex="0"><td>Aug 1</td><td>REI</td></tr></tbody></table>'))).toEqual(['NAME_MISSING']);
    expect(codes(accessibleNames, fixture('<table><tbody><tr tabindex="0" aria-labelledby="c1"><td id="c1">Aug 1</td></tr></tbody></table>'))).toEqual([]);
    expect(codes(accessibleNames, fixture('<div tabindex="0" aria-label="Row"></div>'))).toEqual([]);
    expect(codes(accessibleNames, fixture('<table><tbody><tr tabindex="0" aria-labelledby="nowhere"><td>x</td></tr></tbody></table>'))).toEqual(['NAME_MISSING']);   // a dangling reference is no name
    expect(codes(accessibleNames, fixture('<div tabindex="-1">surface</div><div role="dialog" tabindex="-1"></div>'))).toEqual([]);   // -1 is not a tab stop
    expect(codes(accessibleNames, fixture('<div style="display:none"><table><tbody><tr tabindex="0"><td>x</td></tr></tbody></table></div>'))).toEqual([]);
    expect(accessibleNames.check(fixture('<nisli-table><table><tbody><tr tabindex="0"><td>x</td></tr></tbody></table></nisli-table>'), estimator(400))[0]!.detail).toBe('focusable <tr> has no aria-label or resolving aria-labelledby');
  });

  it('ID_DUPLICATE: an id on two elements fails; unique ids hold', () => {
    expect(codes(uniqueIds, fixture('<div id="a"></div><span id="a"></span>'))).toEqual(['ID_DUPLICATE']);
    expect(uniqueIds.check(fixture('<div id="a"></div><span id="a"></span>'), estimator(400))[0]!.detail).toContain('"a" is on 2 elements');
    expect(codes(uniqueIds, fixture('<div id="a"></div><span id="b"></span>'))).toEqual([]);
  });

  it('LABEL_MISSING: an input inside nisli-form with no label fails; label[for], a wrapping label, aria-label or aria-labelledby hold; outside a form nothing is asked', () => {
    expect(codes(formLabels, fixture('<nisli-form><input id="f-a"></nisli-form>'))).toEqual(['LABEL_MISSING']);
    expect(codes(formLabels, fixture('<nisli-form><label for="f-a">A</label><input id="f-a"><label>B <select></select></label><textarea aria-label="C"></textarea><span id="l">D</span><div role="radiogroup" aria-labelledby="l"><button role="radio">x</button></div></nisli-form>'))).toEqual([]);
    expect(codes(formLabels, fixture('<nisli-form><div role="radiogroup" aria-labelledby="nowhere"></div></nisli-form>'))).toEqual(['LABEL_MISSING']);
    expect(codes(formLabels, fixture('<input id="free">'))).toEqual([]);
    expect(codes(formLabels, fixture('<nisli-form><input type="hidden"><div style="display:none"><input></div></nisli-form>'))).toEqual([]);
  });

  it('LABEL_MISSING (widened): a label[for] must target a labelable element — a radiogroup div, or nothing, is a claim', () => {
    expect(codes(formLabels, fixture('<nisli-form><label for="g" id="g-label">Type</label><div id="g" role="radiogroup" aria-labelledby="g-label"><button role="radio">x</button></div></nisli-form>'))).toEqual(['LABEL_MISSING']);
    expect(formLabels.check(fixture('<nisli-form><label for="g" id="g-label">Type</label><div id="g" role="radiogroup" aria-labelledby="g-label"></div></nisli-form>'), estimator(400))[0]!.detail).toBe('<label for="g"> targets a <div>, which is not labelable');
    expect(codes(formLabels, fixture('<nisli-form><label for="gone">Type</label><input aria-label="t"></nisli-form>'))).toEqual(['LABEL_MISSING']);
    expect(codes(formLabels, fixture('<nisli-form><span id="g-label">Type</span><div id="g" role="radiogroup" aria-labelledby="g-label"></div><label for="c">Caption</label><input id="c" type="checkbox"><label for="s">S</label><select id="s"></select><label for="b">B</label><button id="b">b</button></nisli-form>'))).toEqual([]);
    expect(codes(formLabels, fixture('<label for="free">Free</label><div id="free"></div>'))).toEqual([]);   // outside a form nothing is asked
  });

  it('SORT_UNREACHABLE: a th with aria-sort, or styled cursor:pointer, and no focusable control fails; a th holding a button, or a plain th, holds', () => {
    expect(codes(sortReachable, fixture('<table><thead><tr><th aria-sort="ascending">Date</th></tr></thead></table>'))).toEqual(['SORT_UNREACHABLE']);
    expect(codes(sortReachable, fixture('<table><thead><tr><th style="cursor:pointer">Date</th></tr></thead></table>'))).toEqual(['SORT_UNREACHABLE']);
    expect(codes(sortReachable, fixture('<table><thead><tr><th aria-sort="ascending"><button>Date</button></th><th>Payee</th></tr></thead></table>'))).toEqual([]);
    expect(codes(sortReachable, fixture('<table><thead><tr><th><span tabindex="0">Date</span></th></tr></thead></table>'))).toEqual([]);
    expect(codes(sortReachable, fixture('<div style="display:none"><table><thead><tr><th aria-sort="none">Date</th></tr></thead></table></div>'))).toEqual([]);
    expect(sortReachable.check(fixture('<nisli-table><table><thead><tr><th aria-sort="descending">Amount ↓</th></tr></thead></table></nisli-table>'), estimator(400))[0]!.detail).toBe('<th> "Amount ↓" is sortable but holds no focusable control');
  });

  it('POPUP_ARIA: aria-expanded or aria-haspopup without a resolving aria-controls fails; expanded over a hidden target fails; a controlled, shown target holds', () => {
    expect(codes(popupAria, fixture('<button aria-expanded="false">Menu</button>'))).toEqual(['POPUP_ARIA']);            // the App toggle as it was
    expect(codes(popupAria, fixture('<button aria-haspopup="menu">More</button>'))).toEqual(['POPUP_ARIA']);
    expect(codes(popupAria, fixture('<button aria-expanded="false" aria-controls="gone">Menu</button>'))).toEqual(['POPUP_ARIA']);
    expect(codes(popupAria, fixture('<button aria-expanded="true" aria-controls="m">Menu</button><nav id="m" style="display:none">…</nav>'))).toEqual(['POPUP_ARIA']);
    expect(codes(popupAria, fixture('<button aria-expanded="true" aria-controls="m">Menu</button><nav id="m" style="display:flex;visibility:hidden">…</nav>'))).toEqual(['POPUP_ARIA']);   // unplaced: still hidden
    expect(codes(popupAria, fixture('<button aria-expanded="false" aria-controls="m">Menu</button><nav id="m" style="display:none">…</nav>'))).toEqual([]);
    expect(codes(popupAria, fixture('<button aria-expanded="true" aria-controls="m">Menu</button><nav id="m" style="display:flex;visibility:visible">…</nav>'))).toEqual([]);
    expect(codes(popupAria, fixture('<button aria-haspopup="menu" aria-expanded="false" aria-controls="m">⋯</button><div id="m" role="menu" style="display:none"></div>'))).toEqual([]);
    expect(codes(popupAria, fixture('<div style="display:none"><button aria-expanded="false">Menu</button></div>'))).toEqual([]);
    const claims = popupAria.check(fixture('<nisli-app><button aria-expanded="false" aria-label="Menu">Menu</button></nisli-app>'), estimator(400));
    expect(claims[0]!.block).toBe('nisli-app');
    expect(claims[0]!.detail).toBe('<button> "Menu" has aria-expanded but no aria-controls');
  });

  it('LIVE_TONE: a negative notice under a polite status fails, a non-negative one under an assertive alert fails; the tone map holds', () => {
    expect(codes(liveTone, fixture('<div role="status" aria-live="polite"><div data-nisli-tone="negative">Failed</div></div>'))).toEqual(['LIVE_TONE']);
    expect(codes(liveTone, fixture('<div role="alert" aria-live="assertive"><div data-nisli-tone="positive">Saved</div></div>'))).toEqual(['LIVE_TONE']);
    expect(codes(liveTone, fixture('<div role="status" aria-live="polite"><div data-nisli-tone="positive">Saved</div><div data-nisli-tone="neutral">Note</div></div><div role="alert" aria-live="assertive"><div data-nisli-tone="negative">Failed</div></div>'))).toEqual([]);
    expect(codes(liveTone, fixture('<div role="status" aria-live="polite"><div>no stamp</div></div>'))).toEqual([]);
    // No live container at all (roles stripped, or a container that lost its role/aria-live) is as wrong as the wrong one.
    expect(codes(liveTone, fixture('<div><div data-nisli-tone="negative">Failed</div></div>'))).toEqual(['LIVE_TONE']);
    expect(codes(liveTone, fixture('<div><div data-nisli-tone="positive">Saved</div></div>'))).toEqual(['LIVE_TONE']);
    expect(liveTone.check(fixture('<div><div data-nisli-tone="negative">Failed</div></div>'), estimator(400))[0]!.detail).toBe('a negative notice "Failed" is not announced');
    expect(liveTone.check(fixture('<nisli-notices><div role="status" aria-live="polite"><div data-nisli-tone="negative">Failed×</div></div></nisli-notices>'), estimator(400))[0]!.detail).toBe('a negative notice "Failed×" is announced politely');
  });

  it('DIALOG_ARIA: a dialog without aria-modal or with a dangling aria-labelledby fails; a labelled modal holds', () => {
    expect(codes(dialogAria, fixture('<div role="dialog" aria-labelledby="t"><h2 id="t">Title</h2></div>'))).toEqual(['DIALOG_ARIA']);
    expect(codes(dialogAria, fixture('<div role="dialog" aria-modal="true" aria-labelledby="t"></div>'))).toEqual(['DIALOG_ARIA']);
    expect(codes(dialogAria, fixture('<div role="alertdialog" aria-modal="true"></div>'))).toEqual(['DIALOG_ARIA']);
    expect(codes(dialogAria, fixture('<div role="dialog" aria-modal="true" aria-labelledby="t"><h2 id="t">Title</h2></div>'))).toEqual([]);
    const d = dialogAria.check(fixture('<div role="dialog" aria-labelledby="t"></div>'), estimator(400))[0]!;
    expect(d.detail).toContain('no aria-modal');
    expect(d.detail).toContain('resolves to no text');
  });

  it('MENU_ITEM_ROLE: a plain button inside a menu fails; menuitems (and their each-item wrappers) hold', () => {
    expect(codes(menuItems, fixture('<div role="menu"><button>Export</button></div>'))).toEqual(['MENU_ITEM_ROLE']);
    expect(codes(menuItems, fixture('<div role="menu"><each-item><button role="menuitem">Export</button></each-item><button role="menuitemcheckbox">Tick</button></div>'))).toEqual([]);
    expect(codes(menuItems, fixture('<div role="menu"><a href="/x">Link</a></div>'))).toEqual(['MENU_ITEM_ROLE']);
  });

  it('BLOCK_ERROR: a stamped host fails; a clean tree holds', () => {
    expect(codes(blockErrors, fixture('<nisli-section data-nisli-error="N401"></nisli-section>'))).toEqual(['BLOCK_ERROR']);
    expect(blockErrors.check(fixture('<nisli-section data-nisli-error="N401"></nisli-section>'), estimator(400))[0]!.detail).toBe('<nisli-section> failed with N401');
    expect(codes(blockErrors, fixture('<nisli-section></nisli-section>'))).toEqual([]);
  });

  it('UNREACHABLE: an inert control with no modal open fails; with a modal open the page may be inert but the dialog may not', () => {
    expect(codes(reachable, fixture('<div inert><button>Save</button></div>'))).toEqual(['UNREACHABLE']);
    expect(codes(reachable, fixture('<div><button>Save</button></div>'))).toEqual([]);
    expect(codes(reachable, fixture('<div inert><button>Save</button></div><div role="dialog" aria-modal="true"><button>OK</button></div>'))).toEqual([]);
    expect(codes(reachable, fixture('<div role="dialog" aria-modal="true"><div inert><button>OK</button></div></div>'))).toEqual(['UNREACHABLE']);
    expect(codes(reachable, fixture('<div inert><button disabled>Save</button><div style="display:none"><button>X</button></div></div>'))).toEqual([]);
    // A hidden dialog is not open: the page must be reachable again.
    expect(codes(reachable, fixture('<div inert><button>Save</button></div><div role="dialog" aria-modal="true" style="display:none"></div>'))).toEqual(['UNREACHABLE']);
  });

  it('claimsOf runs every checker; reportClaim turns a layout report into a claim', () => {
    expect(checkers.map((c) => c.code)).toEqual(['OVERFLOW_TEXT', 'NAME_MISSING', 'ID_DUPLICATE', 'LABEL_MISSING', 'DIALOG_ARIA', 'MENU_ITEM_ROLE', 'BLOCK_ERROR', 'UNREACHABLE', 'SORT_UNREACHABLE', 'POPUP_ARIA', 'LIVE_TONE']);
    const root = fixture('<button></button><div id="a"></div><div id="a"></div>');
    expect(claimsOf(root, estimator(400)).map((c) => c.code)).toEqual(['NAME_MISSING', 'ID_DUPLICATE']);
    expect(reportClaim({ code: 'FIT_ROW', block: 'nisli-toolbar', width: 300, deficit: 12.4, detail: 'title "T" and its primary actions cannot fit' }))
      .toEqual({ code: 'FIT_ROW', block: 'nisli-toolbar', severity: 'error', detail: 'title "T" and its primary actions cannot fit (12px short at 300px)' });
  });
});
