/**
 * clipped-loss.test.ts — N710, in both directions.
 *
 * A rule that has never been observed to fail is decoration, so the order here
 * is deliberate: every case proves the rule FIRES on a deliberately broken
 * input before anything proves it stays silent on a good one. The fixtures are
 * the browser probes from the overflow audit, transcribed with their measured
 * numbers, because the whole value of this rule is that the same run makes it
 * both fail and pass on the same geometry:
 *
 *   A1  a table directly inside a flush surface        -> must FAIL
 *   A3  the same table with one wrapper the theme promotes to a scrollport
 *                                                      -> must be SILENT
 *   A5  a 900px decorative gradient, `data-clip="trim"` -> must be SILENT
 *   A6  a declared `data-truncate` overflowing its box  -> must be SILENT
 *
 * A1 and A3 differ by ONE node. That is the point: if the rule cannot tell them
 * apart it is measuring something other than reachability.
 */
import { describe, expect, it } from 'vitest';
import { clippedLossRule } from './rules/clipped-loss.js';
import { FakeInspector } from '../testing.js';
import type { InspectSpec, InspectWorldSpec } from '../testing.js';
import type { Finding } from '../contracts.js';

function run(spec: InspectWorldSpec): readonly Finding[] {
  return clippedLossRule<string>().run(new FakeInspector(spec));
}

/* ══════════════════════════════════════════════════════════════════════════
   The measured geometry, once.
   ══════════════════════════════════════════════════════════════════════════
   Audit §A, at a 360px fixture width: a flush surface 358px wide holding a
   table whose intrinsic width is 835px. Rects rather than sizes, because this
   rule is entirely about WHERE things sit — the clip edge is at 358 and the
   table's last column ends at 835, so the overhang is 477. */

const CLIP_START = 0;
const CLIP_INLINE = 358;
const CLIP_END = CLIP_START + CLIP_INLINE;
const TABLE_INLINE = 835;

/** One header cell, positioned by its start edge. */
function column(id: string, header: string, inlineStart: number, inline: number): InspectSpec {
  return {
    id,
    tag: 'th',
    attrs: { 'data-text': 'label' },
    text: header,
    box: { inline, block: 34, contentInline: inline },
    bounds: { inline, block: 34, inlineStart, blockStart: 0 },
  };
}

/**
 * The audit's eight columns. The first four fit; `Latency p99`, `Error rate`,
 * `Deploy` and `Runtime version` are the ones that were being deleted.
 */
const COLUMNS: readonly InspectSpec[] = [
  column('c-name', 'Name', 0, 120),
  column('c-status', 'Status', 120, 80),
  column('c-owner', 'Owner', 200, 90),
  column('c-updated', 'Updated', 290, 68),
  column('c-latency', 'Latency p99', 358, 110),
  column('c-error', 'Error rate', 468, 100),
  column('c-deploy', 'Deploy', 568, 90),
  column('c-runtime', 'Runtime version', 658, 177),
];

const TABLE: InspectSpec = {
  id: 'table',
  tag: 'table',
  attrs: { 'data-appearance': 'table' },
  box: { inline: TABLE_INLINE, block: 200, contentInline: TABLE_INLINE },
  bounds: { inline: TABLE_INLINE, block: 200, inlineStart: 0, blockStart: 0 },
  children: COLUMNS,
};

/** A flush surface: clips for its rounded corners, declares no trim. */
function flushSurface(children: readonly InspectSpec[], attrs: Record<string, string> = {}) {
  return {
    id: 'surface',
    attrs: { 'data-appearance': 'surface', 'data-flush': '', ...attrs },
    styles: { 'overflow-x': 'clip', 'overflow-y': 'clip' },
    box: { inline: CLIP_INLINE, block: 200, contentInline: CLIP_INLINE },
    bounds: { inline: CLIP_INLINE, block: 200, inlineStart: CLIP_START, blockStart: 0 },
    children,
  } satisfies InspectSpec;
}

function world(surface: InspectSpec): InspectWorldSpec {
  return { viewport: { inline: 360, documentInline: 360 }, nodes: [surface] };
}

/* ══════════════════════════════════════════════════════════════════════════ */

describe('N710 fires on clipped loss', () => {
  it('reports the A1 defect: a table clipped by a flush surface', () => {
    const findings = run(world(flushSurface([TABLE])));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('N710');
    expect(findings[0]?.severity).toBe('fail');
    // Measured: FOUR nodes, all four wholly outside — `Latency p99`, `Error
    // rate`, `Deploy` and `Runtime version`. Written as five at first, on the
    // assumption that the `<table>` counts too. It does not, and the reason is
    // the rule working: a table element carries no text of its own and is not
    // focusable, so it is not what the reader loses — the cells are. Counting
    // the container as well would double-report one deletion, which is the
    // muting cause this rule's own comment warns about.
    expect(findings[0]?.detail).toContain('destroys 4 meaningful node(s)');
    expect(findings[0]?.detail).toContain('4 entirely');
    // The magnitude makes the finding actionable, so it is asserted rather than
    // trusted: 835px of table in a 358px surface.
    expect(findings[0]?.detail).toContain('worst overhang 477.00px');
  });

  it('reports loss towards the inline START, which a scroll extent cannot see', () => {
    // The recorded false PASS: the probe measured only the inline-end edge, then
    // focus scrolled the clipper and the loss moved from end:+414 to
    // start:+414, and it reported zero. Same node, negative origin.
    const findings = run(
      world(
        flushSurface([
          {
            id: 'displaced',
            attrs: { 'data-text': 'body' },
            text: 'Name',
            box: { inline: 120, block: 34, contentInline: 120 },
            bounds: { inline: 120, block: 34, inlineStart: -414, blockStart: 0 },
          },
        ]),
      ),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('worst overhang 414.00px');
    expect(findings[0]?.detail).toContain('1 entirely');
  });

  it('reports loss towards the block START, on the same four-edge comparison', () => {
    const findings = run(
      world(
        flushSurface([
          {
            id: 'above',
            attrs: { 'data-text': 'body' },
            text: 'Latency p99',
            box: { inline: 100, block: 45, contentInline: 100 },
            bounds: { inline: 100, block: 45, inlineStart: 0, blockStart: -45 },
          },
        ]),
      ),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('worst overhang 45.00px');
  });

  it('reports a focusable node with no text, because focus is meaning too', () => {
    const findings = run(
      world(
        flushSurface([
          {
            id: 'action',
            tag: 'button',
            attrs: { 'data-appearance': 'action' },
            box: { inline: 88, block: 36, contentInline: 88 },
            bounds: { inline: 88, block: 36, inlineStart: 400, blockStart: 0 },
          },
        ]),
      ),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('destroys 1 meaningful node(s)');
  });

  it('fires on a `contain: paint` clipper, whose overflow computes to visible', () => {
    // The measured reason this rule asks the port instead of reading a property:
    // paint containment clips while both overflow axes say `visible`.
    const findings = run(
      world({
        id: 'painted',
        attrs: { 'data-appearance': 'surface' },
        styles: { 'overflow-x': 'visible', 'overflow-y': 'visible', contain: 'paint' },
        containment: 'clip',
        box: { inline: 200, block: 40, contentInline: 200 },
        bounds: { inline: 200, block: 40, inlineStart: 0, blockStart: 0 },
        children: [
          {
            id: 'escapee',
            attrs: { 'data-text': 'body' },
            text: 'Runtime version',
            box: { inline: 471, block: 17, contentInline: 471 },
            bounds: { inline: 471, block: 17, inlineStart: 0, blockStart: 0 },
          },
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain('worst overhang 271.00px');
  });
});

describe('N710 admits what it cannot measure, rather than passing', () => {
  it('reports N680 for a clipper whose subtree is skipped by content-visibility', () => {
    // The measured false PASS in full: the clipper reports 200/200, every
    // skipped child measures 0x0, `checkVisibility()` still answers true, and
    // `painted()` therefore hands the rule nothing at all. Silence here is the
    // defect; N680 is the only honest answer.
    const findings = run(
      world({
        id: 'lazy',
        attrs: { 'data-appearance': 'surface', 'data-flush': '' },
        styles: { 'overflow-x': 'clip', 'overflow-y': 'clip' },
        box: { inline: 200, block: 40, contentInline: 200 },
        bounds: { inline: 200, block: 40, inlineStart: 0, blockStart: 0 },
        children: [
          {
            id: 'skipped',
            attrs: { 'data-text': 'body' },
            text: 'Runtime version',
            rendered: false,
            measurable: false,
            box: { inline: 0, block: 0, contentInline: 0 },
            bounds: { inline: 0, block: 0, inlineStart: 0, blockStart: 0 },
          },
        ],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('N680');
    expect(findings[0]?.severity).toBe('incomplete');
    // The asking rule has to be named, or an incomplete is unactionable.
    expect(findings[0]?.detail).toContain('N710');
    expect(findings[0]?.detail).toContain('content-visibility');
  });

  it('does not also claim a verdict about the measurable half of that subtree', () => {
    // One admission, not an admission plus a finding: a clip over content the
    // checker cannot see is undecided, and reporting both would let a reader
    // treat the count as complete.
    const findings = run(
      world({
        id: 'lazy',
        attrs: { 'data-appearance': 'surface', 'data-flush': '' },
        styles: { 'overflow-x': 'clip', 'overflow-y': 'clip' },
        box: { inline: 200, block: 40, contentInline: 200 },
        bounds: { inline: 200, block: 40, inlineStart: 0, blockStart: 0 },
        children: [
          {
            id: 'skipped',
            text: 'hidden away',
            rendered: false,
            measurable: false,
            box: { inline: 0, block: 0, contentInline: 0 },
            bounds: { inline: 0, block: 0, inlineStart: 0, blockStart: 0 },
          },
          {
            id: 'overhanging',
            attrs: { 'data-text': 'body' },
            text: 'Deploy',
            box: { inline: 400, block: 17, contentInline: 400 },
            bounds: { inline: 400, block: 17, inlineStart: 0, blockStart: 0 },
          },
        ],
      }),
    );
    expect(findings.map((finding) => finding.code)).toEqual(['N680']);
  });
});

describe('N710 stays silent where the loss is answered for', () => {
  it('is silent on A3: one wrapper, promoted to a scrollport by the theme', () => {
    // A1 plus exactly one node. The wrapper inherits the clipper's width and
    // scrolls, so every column is reachable and nothing is lost. Measured in
    // the browser on the real theme: 0 lost, 477px reachable, scrollLeft
    // 477/477, tabindex="0".
    const findings = run(
      world(
        flushSurface([
          {
            id: 'port',
            attrs: { 'data-component': 'app-data-table', tabindex: '0' },
            styles: { 'overflow-x': 'auto', 'overflow-y': 'auto' },
            box: { inline: CLIP_INLINE, block: 200, contentInline: TABLE_INLINE },
            bounds: { inline: CLIP_INLINE, block: 200, inlineStart: CLIP_START, blockStart: 0 },
            children: [TABLE],
          },
        ]),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('is silent on A5: a decorative gradient under a declared `data-clip="trim"`', () => {
    // 900px of gradient in a 358px box. Nothing measurable distinguishes it
    // from a table, which is exactly why the author declares it.
    const findings = run(
      world(
        flushSurface(
          [
            {
              id: 'gradient',
              attrs: { 'data-component': 'app-hero', 'aria-hidden': 'true' },
              box: { inline: 900, block: 12, contentInline: 900 },
              bounds: { inline: 900, block: 12, inlineStart: 0, blockStart: 0 },
            },
          ],
          { 'data-clip': 'trim' },
        ),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('is silent on A6: a node the solver already truncated', () => {
    // The ellipsis is the receipt. Reporting this would be the checker refusing
    // a loss the reader was told about.
    const findings = run(
      world(
        flushSurface([
          {
            id: 'excerpt',
            attrs: { 'data-text': 'body', 'data-truncate': '' },
            text: 'Quarterly numbers are in and the deploy window moved to Thursday',
            styles: { 'overflow-x': 'hidden', 'text-overflow': 'ellipsis' },
            containment: 'clip',
            box: { inline: CLIP_INLINE, block: 18, contentInline: 507 },
            bounds: { inline: 507, block: 18, inlineStart: 0, blockStart: 0 },
          },
        ]),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('is silent inside an escaped subtree, which forfeited the guarantee', () => {
    const findings = run(
      world(
        flushSurface([
          {
            id: 'escape',
            attrs: { 'data-escaped': 'margin-block-start: 7px' },
            box: { inline: CLIP_INLINE, block: 40, contentInline: CLIP_INLINE },
            bounds: { inline: CLIP_INLINE, block: 40, inlineStart: 0, blockStart: 0 },
            children: [
              {
                id: 'raw',
                attrs: { 'data-text': 'body' },
                text: 'Runtime version',
                box: { inline: 600, block: 17, contentInline: 600 },
                bounds: { inline: 600, block: 17, inlineStart: 0, blockStart: 0 },
              },
            ],
          },
        ]),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('is silent on a non-clipping box, however far its content escapes', () => {
    // An honest overflow is N660's business and is reported with better
    // numbers there. Two rules claiming one node is how a code gets muted.
    const findings = run(
      world({
        id: 'row',
        attrs: { 'data-layout': 'row' },
        styles: { 'overflow-x': 'visible', 'overflow-y': 'visible' },
        box: { inline: 320, block: 40, contentInline: 800 },
        bounds: { inline: 320, block: 40, inlineStart: 0, blockStart: 0 },
        children: [
          {
            id: 'wide',
            attrs: { 'data-text': 'body' },
            text: 'Runtime version',
            box: { inline: 800, block: 17, contentInline: 800 },
            bounds: { inline: 800, block: 17, inlineStart: 0, blockStart: 0 },
          },
        ],
      }),
    );
    expect(findings).toEqual([]);
  });

  it('is silent when the clipped material carries neither text nor focus', () => {
    const findings = run(
      world(
        flushSurface([
          {
            id: 'spacer',
            attrs: { 'aria-hidden': 'true' },
            box: { inline: 900, block: 8, contentInline: 900 },
            bounds: { inline: 900, block: 8, inlineStart: 0, blockStart: 0 },
          },
        ]),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('is silent when everything fits, so a clipping box is not itself a defect', () => {
    const findings = run(world(flushSurface([column('only', 'Name', 0, 120)])));
    expect(findings).toEqual([]);
  });
});

describe('N710 measures reachability, not tidiness', () => {
  it('does not fire on a column that a scroller between it and the clipper reaches', () => {
    // The audit's probe bug 3: comparing descendants against the clipper
    // reported 16 lost columns inside a WORKING scroll region. A rule that
    // fires on the fix is worse than one that stays quiet.
    const findings = run(
      world(
        flushSurface([
          {
            id: 'port',
            styles: { 'overflow-x': 'auto', 'overflow-y': 'auto' },
            box: { inline: CLIP_INLINE, block: 200, contentInline: TABLE_INLINE },
            bounds: { inline: CLIP_INLINE, block: 200, inlineStart: 0, blockStart: 0 },
            children: COLUMNS,
          },
        ]),
      ),
    );
    expect(findings).toEqual([]);
  });

  it('still fires on a sibling of the scroller, which nothing reaches', () => {
    // The exemption is per subtree, not per clipper: promoting one child does
    // not make the clipper safe for everything else inside it.
    const findings = run(
      world(
        flushSurface([
          {
            id: 'port',
            styles: { 'overflow-x': 'auto', 'overflow-y': 'auto' },
            box: { inline: CLIP_INLINE, block: 200, contentInline: TABLE_INLINE },
            bounds: { inline: CLIP_INLINE, block: 200, inlineStart: 0, blockStart: 0 },
            children: COLUMNS,
          },
          {
            id: 'footnote',
            attrs: { 'data-text': 'meta' },
            text: 'Updated 2m ago across every region',
            box: { inline: 500, block: 17, contentInline: 500 },
            bounds: { inline: 500, block: 17, inlineStart: 0, blockStart: 210 },
          },
        ]),
      ),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.subject).toContain('surface');
    expect(findings[0]?.detail).toContain('destroys 1 meaningful node(s)');
  });

  it('reports each clipper once, not once per lost node', () => {
    // Five overhanging nodes in A1 produce one finding naming the box that has
    // to change. "One defect reported N times" is a recorded muting cause.
    const findings = run(world(flushSurface([TABLE])));
    expect(findings).toHaveLength(1);
  });
});
