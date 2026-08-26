/**
 * diagnostics.test.ts — the derived checker, driven through a fake Inspector.
 *
 * Two properties matter more than coverage here. A rule must FIRE on the
 * defect it was allocated for, and it must stay SILENT on a clean document —
 * an oracle that cries wolf gets muted, and a muted oracle is worth nothing.
 * The round-2 corpus records three false-PASS oracles and, in F4, one
 * false-FAIL wave from this very experiment.
 */
import { describe, expect, it } from 'vitest';
import { CODES } from '../src/appearance/diagnostics/codes.js';
import { DEFAULT_RULES, check } from '../src/appearance/diagnostics/runner.js';
import { formatFindings, summarize } from '../src/appearance/diagnostics/report.js';
import { FakeInspector } from './fakes.js';
import type { InspectSpec, InspectWorldSpec } from './fakes.js';
import type { Finding, Rule } from '../src/appearance/contracts.js';

function ruleFor(code: string): Rule<string> {
  const found = DEFAULT_RULES<string>().find((rule) => rule.code === code);
  if (!found) throw new Error(`no default rule allocated for ${code}`);
  return found;
}

function run(code: string, spec: InspectWorldSpec): readonly Finding[] {
  return ruleFor(code).run(new FakeInspector(spec));
}

// A computed line-height is always a length or the keyword `normal` in a real
// browser; N690 derives its line count from it, so the fixture carries one.
const READABLE = {
  color: 'rgb(24, 24, 27)',
  'font-size': '14px',
  'font-weight': '400',
  'line-height': '18px',
};

/**
 * A document with nothing wrong with it: legal vocabulary, a settled row, one
 * intentional truncation that still reads, a hit target at its floor, readable
 * text on a painted backdrop, and no overflow anywhere.
 */
const CLEAN: InspectWorldSpec = {
  viewport: { inline: 1024, documentInline: 1024 },
  nodes: [
    {
      id: 'shell',
      attrs: { 'data-layout': 'stack' },
      box: { inline: 1024, block: 600, contentInline: 1024 },
      children: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row', 'data-fit': 'settled' },
          box: { inline: 320, block: 40, contentInline: 300 },
          children: [
            {
              id: 'sender',
              attrs: { 'data-text': 'title' },
              text: 'Ada Lovelace',
              styles: READABLE,
              box: { inline: 120, block: 18, contentInline: 118 },
            },
            {
              id: 'excerpt',
              attrs: { 'data-text': 'body', 'data-truncate': '' },
              text: 'The analytical engine weaves algebraic patterns',
              styles: READABLE,
              box: { inline: 120, block: 18, contentInline: 240 },
            },
            {
              id: 'reply',
              attrs: { 'data-appearance': 'action', 'data-emphasis': 'primary' },
              text: 'Reply',
              styles: { ...READABLE, '--min-target': '44px' },
              box: { inline: 44, block: 44, contentInline: 40 },
            },
          ],
        },
      ],
    },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   The registry
   ══════════════════════════════════════════════════════════════════════════ */

describe('CODES', () => {
  it('allocates exactly the agreed codes, keyed by themselves', () => {
    // Append-only, forever: a renumbered code silently invalidates every
    // suppression, dashboard and doc link that ever referenced it.
    expect(Object.keys(CODES).sort()).toEqual([
      'N601',
      'N610',
      'N620',
      'N621',
      'N630',
      'N640',
      'N650',
      'N660',
      'N670',
      'N680',
      'N690',
      'N700',
      'N710',
      'N713',
      'N715',
    ]);
    for (const [key, entry] of Object.entries(CODES)) expect(entry.code).toBe(key);
  });

  it('registers every default rule and gives it a title', () => {
    for (const rule of DEFAULT_RULES<string>()) {
      expect(CODES[rule.code], `${rule.code} is unregistered`).toBeDefined();
      expect(rule.title.length).toBeGreaterThan(0);
    }
  });

  it('hands out a fresh array each call, so a caller cannot poison the defaults', () => {
    expect(DEFAULT_RULES<string>()).not.toBe(DEFAULT_RULES<string>());
    expect(DEFAULT_RULES<string>().map((r) => r.code)).toEqual(
      DEFAULT_RULES<string>().map((r) => r.code),
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Silence on a clean document
   ══════════════════════════════════════════════════════════════════════════ */

describe('a clean document', () => {
  it('produces no findings from any rule', () => {
    const findings = check(new FakeInspector(CLEAN));
    expect(findings).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   One rule at a time
   ══════════════════════════════════════════════════════════════════════════ */

describe('N601 — escaped subtree', () => {
  it('warns once per escape hatch, because the hatch is opt-in and counted', () => {
    const findings = run('N601', {
      nodes: [{ id: 'brand', attrs: { 'data-escaped': 'vendor marketing panel' } }],
    });

    expect(findings.map((f) => f.code)).toEqual(['N601']);
    expect(findings[0]?.severity).toBe('warn');
    expect(findings[0]?.detail).toContain('vendor marketing panel');
  });
});

describe('N610 — value outside the vocabulary', () => {
  it('fails a layout value the vocabulary does not contain', () => {
    const findings = run('N610', {
      nodes: [{ id: 'odd', attrs: { 'data-layout': 'flexbox' } }],
    });

    expect(findings.map((f) => f.code)).toEqual(['N610']);
    expect(findings[0]?.severity).toBe('fail');
    expect(findings[0]?.detail).toContain('flexbox');
  });

  it('accepts every legal value', () => {
    const findings = run('N610', {
      nodes: [
        { id: 'a', attrs: { 'data-layout': 'grid', 'data-density': 'dense' } },
        { id: 'b', attrs: { 'data-appearance': 'nav-item', 'data-emphasis': 'quiet' } },
        { id: 'c', attrs: { 'data-text': 'meta', 'data-collapse': 'menu' } },
        { id: 'd', attrs: { 'data-theme': 'dark', 'data-input': 'touch' } },
      ],
    });

    expect(findings).toEqual([]);
  });
});

describe('N620 — fit unsatisfiable', () => {
  it('fails a container that promised to fit and could not', () => {
    const findings = run('N620', {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': 'unsatisfiable' },
          box: { inline: 320, block: 40, contentInline: 512 },
        },
      ],
    });

    expect(findings.map((f) => f.code)).toEqual(['N620']);
    expect(findings[0]?.severity).toBe('fail');
  });

  it('says nothing about a settled container', () => {
    const findings = run('N620', {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-fit': 'settled' },
          box: { inline: 320, block: 40, contentInline: 300 },
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});

describe('N621 — truncation degenerate', () => {
  it('warns about the F5 timestamp, clamped down to a character and an ellipsis', () => {
    const findings = run('N621', {
      nodes: [
        {
          id: 'time',
          attrs: { 'data-truncate': '' },
          text: '3 years ago',
          box: { inline: 14, block: 18, contentInline: 70 },
        },
      ],
    });

    expect(findings.map((f) => f.code)).toEqual(['N621']);
    expect(findings[0]?.severity).toBe('warn');
  });

  it('leaves a clamped sentence alone', () => {
    const findings = run('N621', {
      nodes: [
        {
          id: 'excerpt',
          attrs: { 'data-truncate': '' },
          text: 'The analytical engine weaves algebraic patterns as the loom weaves flowers',
          box: { inline: 240, block: 18, contentInline: 480 },
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});

describe('N630 — document exceeds viewport', () => {
  it('fails when the document is wider than the window', () => {
    const findings = run('N630', {
      nodes: [],
      viewport: { inline: 320, documentInline: 400 },
    });

    expect(findings.map((f) => f.code)).toEqual(['N630']);
    expect(findings[0]?.severity).toBe('fail');
  });

  it('passes when the document fits exactly', () => {
    expect(run('N630', { nodes: [], viewport: { inline: 320, documentInline: 320 } })).toEqual([]);
  });
});

describe('N640 — text contrast', () => {
  it('fails light text on white — the exact F3 measurement', () => {
    // The first dark-mode run set `--fg` without painting `--s1`, and the
    // derived checker reported 1.10:1 before any human looked at the screen.
    const findings = run('N640', {
      nodes: [
        {
          id: 'title',
          attrs: { 'data-text': 'title' },
          text: 'Inbox',
          styles: { color: 'rgb(244, 244, 245)', 'font-size': '14px', 'font-weight': '400' },
          backdrop: 'rgb(255, 255, 255)',
        },
      ],
    });

    expect(findings.map((f) => f.code)).toEqual(['N640']);
    expect(findings[0]?.severity).toBe('fail');
    expect(findings[0]?.detail).toContain('1.1');
  });

  it('passes dark text on white', () => {
    const findings = run('N640', {
      nodes: [
        {
          id: 'title',
          attrs: { 'data-text': 'title' },
          text: 'Inbox',
          styles: READABLE,
          backdrop: 'rgb(255, 255, 255)',
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('says nothing about an element with no text to read', () => {
    const findings = run('N640', {
      nodes: [
        {
          id: 'spacer',
          attrs: { 'data-text': 'body' },
          text: '   ',
          styles: { color: 'rgb(250, 250, 250)', 'font-size': '14px', 'font-weight': '400' },
          backdrop: 'rgb(255, 255, 255)',
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});

describe('N650 — hit target below the context floor', () => {
  it('fails a control smaller than the floor its context declared', () => {
    const findings = run('N650', {
      nodes: [
        {
          id: 'star',
          attrs: { 'data-appearance': 'action' },
          styles: { '--min-target': '44px' },
          box: { inline: 24, block: 24, contentInline: 24 },
        },
      ],
    });

    expect(findings.map((f) => f.code)).toEqual(['N650']);
    expect(findings[0]?.severity).toBe('fail');
  });

  it('F4 — does not fire on an unrendered node', () => {
    // The recorded defect: collapsed candidates are `display: none` and
    // measure 0x0, which produced ten false N650 failures on the first run.
    // Rendered-ness is a precondition of every measurement, not a filter
    // applied to the results afterwards.
    const findings = run('N650', {
      nodes: [
        {
          id: 'collapsed-star',
          attrs: { 'data-appearance': 'action' },
          styles: { '--min-target': '44px' },
          box: { inline: 0, block: 0, contentInline: 0 },
          rendered: false,
        },
        {
          id: 'collapsed-archive',
          attrs: { 'data-appearance': 'nav-item' },
          styles: { '--min-target': '44px' },
          box: { inline: 0, block: 0, contentInline: 0 },
          rendered: false,
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('says nothing in a context that declared no floor', () => {
    const findings = run('N650', {
      nodes: [
        {
          id: 'star',
          attrs: { 'data-appearance': 'action' },
          box: { inline: 24, block: 24, contentInline: 24 },
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});

describe('N660 — element crushed', () => {
  it('fails a node whose content is wider than the box it was given', () => {
    // 71 units of Reply button squeezed into 32 — the measurement from F8.
    const findings = run('N660', {
      nodes: [
        {
          id: 'root',
          attrs: { 'data-layout': 'row' },
          children: [{ id: 'reply', box: { inline: 32, block: 24, contentInline: 71 } }],
        },
      ],
    });

    expect(findings.map((f) => f.subject)).toEqual(['reply']);
    expect(findings[0]?.code).toBe('N660');
    expect(findings[0]?.severity).toBe('fail');
  });

  it('exempts truncation, fields, scrollers, document furniture and the escape hatch', () => {
    const findings = run('N660', {
      nodes: [
        {
          id: 'root',
          attrs: { 'data-layout': 'stack' },
          children: [
            {
              id: 'clipped',
              attrs: { 'data-truncate': '' },
              box: { inline: 40, block: 18, contentInline: 200 },
            },
            {
              id: 'scroller',
              styles: { 'overflow-x': 'auto' },
              box: { inline: 100, block: 40, contentInline: 400 },
            },
            {
              // A text input scrolls its own value: content wider than the box
              // is the field working, not the layout failing.
              id: 'search',
              tag: 'input',
              attrs: { 'data-appearance': 'field' },
              box: { inline: 120, block: 32, contentInline: 600 },
            },
            {
              // Document furniture is not appearance and owns no box worth
              // reporting on.
              id: 'page-body',
              tag: 'body',
              box: { inline: 320, block: 900, contentInline: 4000 },
            },
            {
              id: 'escaped',
              attrs: { 'data-escaped': 'vendor panel' },
              box: { inline: 10, block: 40, contentInline: 99 },
              children: [{ id: 'escaped-child', box: { inline: 5, block: 20, contentInline: 50 } }],
            },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('does not fire on an unrendered node', () => {
    const findings = run('N660', {
      nodes: [
        {
          id: 'hidden-reply',
          box: { inline: 0, block: 0, contentInline: 71 },
          rendered: false,
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('hands clipped content to N710 and is still not fooled by an unset overflow-x', () => {
    // THIS TEST ASSERTED THE OPPOSITE UNTIL N710 EXISTED, and the reversal is
    // the point rather than a detail. It used to be titled "still fails clipped
    // content", on the argument that clipped content is unreadable content
    // whoever asked for the clipping. That was right about the DEFECT and wrong
    // about the CLAIM: N660 says "this box did not get the inline space its
    // content needs, so the overflow lands on a neighbour", and for a clipper
    // nothing lands anywhere — the content is deleted. N710 owns clipped loss
    // now, with the numbers that matter, and reporting one node twice with
    // contradictory claims is a recorded muting cause.
    //
    // The fail-safe polarity it was originally written to protect survives
    // intact, and that is why `unset` is still here: the exemption ENUMERATES
    // what is exempt rather than testing `overflow-x !== 'visible'`, so a node
    // whose overflow reads as the empty string stays IN the check. The negative
    // spelling would exempt every element and go silently vacuous in a fake
    // while still working in Chromium — a false-PASS oracle in waiting.
    //
    // `contained` is the node that proves the exemption is about CLIPPING and
    // not about an overflow string. Measured, Chromium 151: `contain: paint`
    // clips a 471px child inside a 200px box while BOTH overflow axes compute
    // to `visible`. No fixture can derive that from a property, which is
    // precisely why the port answers the question itself.
    const findings = run('N660', {
      nodes: [
        { id: 'hidden', styles: { 'overflow-x': 'hidden' }, box: { inline: 40, block: 20, contentInline: 200 } },
        { id: 'clip', styles: { 'overflow-x': 'clip' }, box: { inline: 40, block: 20, contentInline: 200 } },
        { id: 'contained', containment: 'clip', box: { inline: 40, block: 20, contentInline: 200 } },
        { id: 'unset', box: { inline: 40, block: 20, contentInline: 200 } },
      ],
    });

    expect(findings.map((f) => f.subject)).toEqual(['unset']);
  });
});

describe('N670 — sibling boxes overlap', () => {
  it('says nothing about a row that merely overflows — that is not a collision', () => {
    // The container-level inference this rule used to carry was removed on
    // matrix evidence: it fired when children extend PAST an overflowing row,
    // where nothing collides and the content simply escapes, and it was silent
    // at 318/318 where the children had been crushed to fit — which is the
    // actual F8 collision. Anti-correlated with the defect it existed to
    // catch. What remains is one inference, and this fixture is the case the
    // old spelling got wrong.
    const findings = run('N670', {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 260 },
          children: [
            { id: 'a', box: { inline: 100, block: 40, contentInline: 100 } },
            { id: 'b', box: { inline: 100, block: 40, contentInline: 100 } },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });

  it('fails a crushed child that necessarily paints into the next sibling', () => {
    const findings = run('N670', {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 200 },
          children: [
            { id: 'star', box: { inline: 20, block: 40, contentInline: 60 } },
            { id: 'reply', box: { inline: 30, block: 40, contentInline: 80 } },
          ],
        },
      ],
    });

    // The last child has nothing to its right in the inline axis, so it
    // overflows the row rather than a sibling — N660's business, not N670's.
    expect(findings.map((f) => f.subject)).toEqual(['star']);
  });

  it('says nothing about a row that fits', () => {
    const findings = run('N670', {
      nodes: [
        {
          id: 'row',
          attrs: { 'data-layout': 'row' },
          box: { inline: 200, block: 40, contentInline: 180 },
          children: [
            { id: 'star', box: { inline: 60, block: 40, contentInline: 60 } },
            { id: 'reply', box: { inline: 120, block: 40, contentInline: 120 } },
          ],
        },
      ],
    });

    expect(findings).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   Admitted failures — a container that already said it could not fit
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A container carrying `data-fit="unsatisfiable"` has declared its failure,
 * and N620 says it better than N660 or N670 can: it names the shortfall and
 * the degradations already spent. Reporting the same pixels three times adds
 * no fact and trains people to mute the codes. Exactly that node is exempt —
 * and only that node, because the whole point of the crush class is the child
 * nobody would otherwise notice.
 */
const ADMITTED: InspectWorldSpec = {
  nodes: [
    {
      id: 'outer',
      attrs: { 'data-layout': 'row' },
      box: { inline: 200, block: 60, contentInline: 200 },
      children: [
        {
          id: 'admitted-row',
          attrs: {
            'data-fit': 'unsatisfiable',
            'data-collapsed-count': '2',
            'data-layout': 'row',
          },
          box: { inline: 200, block: 40, contentInline: 260 },
          children: [
            {
              id: 'crushed-title',
              attrs: { 'data-text': 'title' },
              text: 'Comfortable',
              box: { inline: 75, block: 18, contentInline: 96 },
            },
            { id: 'tail', box: { inline: 60, block: 18, contentInline: 60 } },
          ],
        },
        { id: 'neighbour', box: { inline: 60, block: 40, contentInline: 60 } },
      ],
    },
  ],
};

/**
 * N690's world. A "word" cannot occupy more lines than there are words unless it
 * was broken inside itself, so the line count is the witness. The three nodes
 * are: a single word rendered over three lines (shredded), ordinary prose
 * wrapped at its spaces (fine), and an unspaced script where the inference does
 * not hold at all (must decline).
 */
const WRAPPING: InspectWorldSpec = {
  nodes: [
    {
      id: 'cards',
      attrs: { 'data-layout': 'grid' },
      box: { inline: 320, block: 200, contentInline: 320 },
      children: [
        {
          id: 'shredded-title',
          attrs: { 'data-text': 'title' },
          text: 'Comfortable',
          styles: { ...READABLE, 'line-height': '18px' },
          box: { inline: 40, block: 54, contentInline: 40 },
        },
        {
          id: 'wrapped-prose',
          attrs: { 'data-text': 'body' },
          text: 'A larger hit target arrives with the input mode',
          styles: { ...READABLE, 'line-height': '18px' },
          box: { inline: 120, block: 54, contentInline: 120 },
        },
        {
          id: 'unspaced',
          attrs: { 'data-text': 'body' },
          text: '快速的棕色狐狸跳过了那只懒狗',
          styles: { ...READABLE, 'line-height': '18px' },
          box: { inline: 40, block: 90, contentInline: 40 },
        },
      ],
    },
  ],
};

describe('N690 — word shredded to fit its box', () => {
  it('shredded-single-word: fires when one word occupies more lines than there are words', () => {
    const subjects = run('N690', WRAPPING).map((finding) => finding.subject);
    expect(subjects).toContain('shredded-title');
  });

  it('wrapped-prose-is-silent: prose breaking at its spaces is not a defect', () => {
    const subjects = run('N690', WRAPPING).map((finding) => finding.subject);
    expect(subjects).not.toContain('wrapped-prose');
  });

  it('unspaced-script-declines: the lines>words inference does not hold without word spaces', () => {
    const subjects = run('N690', WRAPPING).map((finding) => finding.subject);
    expect(subjects).not.toContain('unspaced');
  });

  it('undecidable-line-height: reports incomplete rather than guessing a line count', () => {
    const findings = run('N690', {
      nodes: [
        {
          id: 'keyword-line-height',
          attrs: { 'data-text': 'body' },
          text: 'Comfortable',
          styles: { ...READABLE, 'line-height': 'normal' },
          box: { inline: 40, block: 54, contentInline: 40 },
        },
      ],
    });
    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
    expect(findings[0]?.severity).toBe('incomplete');
  });

  it('stays silent on the clean document', () => {
    expect(run('N690', CLEAN)).toEqual([]);
  });
});

/**
 * N700's world. Scope is the whole design of this rule, so the fixtures are
 * built to pin the scope decision rather than the counting: `SIBLING_CARDS` is
 * the marketing page's real shape — four self-contained cards, each with its own
 * primary action — and it MUST stay silent, while a single surface owning two
 * emphatic actions MUST fire exactly once.
 */
const emphatic = (id: string, role: 'primary' | 'danger'): InspectSpec => ({
  id,
  tag: 'button',
  attrs: { 'data-appearance': 'action', 'data-role': role },
});

const SIBLING_CARDS: InspectWorldSpec = {
  nodes: [
    {
      id: 'page',
      attrs: { 'data-component': 'app-region' },
      children: [
        { id: 'card-a', attrs: { 'data-appearance': 'surface' }, children: [emphatic('save-a', 'primary')] },
        { id: 'card-b', attrs: { 'data-appearance': 'surface' }, children: [emphatic('save-b', 'primary')] },
        { id: 'card-c', attrs: { 'data-appearance': 'surface' }, children: [emphatic('save-c', 'primary')] },
      ],
    },
  ],
};

describe('N700 — competing primary actions', () => {
  it('fires once when one surface owns two emphatic actions', () => {
    const findings = run('N700', {
      nodes: [
        {
          id: 'panel',
          attrs: { 'data-appearance': 'surface' },
          children: [emphatic('save', 'primary'), emphatic('delete', 'danger')],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['panel']);
    // primary and danger COMPETE rather than coexisting: both spend the same
    // attention, which is why the GNOME rule counts them together.
    expect(findings[0]?.detail).toContain('save');
    expect(findings[0]?.detail).toContain('delete');
    expect(findings[0]?.severity).toBe('fail');
  });

  it('sibling-cards: stays silent when each surface owns exactly one', () => {
    // The marketing page's real shape. A page-scoped version of this rule would
    // report three defects here, all of them wrong, and get muted.
    expect(run('N700', SIBLING_CARDS)).toEqual([]);
  });

  it('nested-ownership: a violation is reported by its own surface, not its ancestors', () => {
    const findings = run('N700', {
      nodes: [
        {
          id: 'page',
          attrs: { 'data-component': 'app-region' },
          children: [
            {
              id: 'card',
              attrs: { 'data-appearance': 'surface' },
              children: [emphatic('save', 'primary'), emphatic('publish', 'primary')],
            },
          ],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['card']);
  });

  it('a region owning emphatic actions directly is itself a surface', () => {
    const findings = run('N700', {
      nodes: [
        {
          id: 'bare-region',
          attrs: { 'data-component': 'app-region' },
          children: [emphatic('save', 'primary'), emphatic('discard', 'danger')],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['bare-region']);
  });

  it('counts an unrendered declaration: this is a claim about source, not layout', () => {
    // Deliberately `declared()` rather than `painted()`. Every component host in
    // this framework is `display: contents` and therefore answers "not
    // rendered"; a rule about what the author wrote must not depend on layout.
    const findings = run('N700', {
      nodes: [
        {
          id: 'panel',
          attrs: { 'data-appearance': 'surface' },
          children: [
            emphatic('save', 'primary'),
            { ...emphatic('hidden-publish', 'primary'), rendered: false },
          ],
        },
      ],
    });
    expect(findings.map((finding) => finding.subject)).toEqual(['panel']);
  });

  it('ignores quiet actions entirely', () => {
    expect(
      run('N700', {
        nodes: [
          {
            id: 'panel',
            attrs: { 'data-appearance': 'surface' },
            children: [
              emphatic('save', 'primary'),
              { id: 'cancel', tag: 'button', attrs: { 'data-appearance': 'action', 'data-role': 'quiet' } },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it('stays silent on the clean document', () => {
    expect(run('N700', CLEAN)).toEqual([]);
  });
});

describe('an admitted failure', () => {
  it('admitted-container-reports-once: N620 and nothing else about the container', () => {
    const about = (code: string) =>
      run(code, ADMITTED)
        .filter((f) => f.subject === 'admitted-row')
        .map((f) => f.code);

    expect(about('N620')).toEqual(['N620']);
    expect(about('N660')).toEqual([]);
    expect(about('N670')).toEqual([]);
  });

  it('crushed-child-inside-admitted-container-still-fires: the child is not exempt', () => {
    // 96 of content in a 75 box, the "Comfortable" measurement. The parent
    // admitting defeat says nothing about whether this child paints over its
    // neighbour, and this is exactly the shape F8 hid behind.
    expect(run('N660', ADMITTED).map((f) => f.subject)).toContain('crushed-title');
    expect(run('N670', ADMITTED).map((f) => f.subject)).toContain('crushed-title');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The runner
   ══════════════════════════════════════════════════════════════════════════ */

describe('check', () => {
  it('turns a throwing rule into N680 and keeps going', () => {
    // A rule that cannot measure must degrade to `incomplete`, never take the
    // rest of the run down with it: three-valued output is the whole reason
    // the severity type has an `incomplete` arm.
    const explodes: Rule<string> = {
      code: 'N660',
      title: 'element crushed',
      run() {
        throw new Error('measurement impossible: node detached');
      },
    };
    const alwaysFires: Rule<string> = {
      code: 'N601',
      title: 'escaped subtree',
      run: () => [
        { code: 'N601', severity: 'warn', subject: 'brand', detail: 'escaped on purpose' },
      ],
    };

    const findings = check(new FakeInspector(CLEAN), [explodes, alwaysFires]);

    expect(findings.map((f) => f.code)).toEqual(['N680', 'N601']);
    expect(findings[0]?.severity).toBe('incomplete');
    expect(findings[0]?.detail).toContain('measurement impossible');
  });

  it('runs the rules it is given and nothing else', () => {
    const findings = check(new FakeInspector(CLEAN), [ruleFor('N630')]);
    expect(findings).toEqual([]);
  });

  it('stamps a docs link onto every finding', () => {
    const findings = check(new FakeInspector({ nodes: [], viewport: { inline: 320, documentInline: 900 } }));
    expect(findings.map((f) => f.code)).toEqual(['N630']);
    expect(findings[0]?.docs).toContain('n630');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   The report
   ══════════════════════════════════════════════════════════════════════════ */

const SAMPLE: readonly Finding[] = [
  { code: 'N601', severity: 'warn', subject: 'brand', detail: 'escaped' },
  { code: 'N660', severity: 'fail', subject: 'reply', detail: 'crushed' },
  { code: 'N670', severity: 'fail', subject: 'star', detail: 'overlaps' },
  { code: 'N680', severity: 'incomplete', subject: 'N640', detail: 'unmeasurable' },
];

describe('summarize', () => {
  it('counts each severity', () => {
    expect(summarize(SAMPLE)).toEqual({ fail: 2, warn: 1, incomplete: 1 });
  });

  it('counts nothing for no findings', () => {
    expect(summarize([])).toEqual({ fail: 0, warn: 0, incomplete: 0 });
  });
});

describe('formatFindings', () => {
  it('names every finding by code, severity and subject', () => {
    const text = formatFindings(SAMPLE);
    for (const finding of SAMPLE) {
      expect(text).toContain(finding.code);
      expect(text).toContain(finding.subject);
    }
  });

  it('says something for an empty run rather than nothing at all', () => {
    expect(formatFindings([]).length).toBeGreaterThan(0);
  });
});
