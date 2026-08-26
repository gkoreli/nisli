/**
 * intent/surface.ts — THE INTENT-DECLARED SURFACE. The file the whole
 * integration is an argument about.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║ ZERO pixel values. ZERO colours. ZERO breakpoints. ZERO media queries. ║
 * ║ ZERO class names. Grep this file and the guard in surface.test.ts.     ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * The only digits below are `data-priority` ordinals, which are the vocabulary
 * itself (`Priority = 1 | 2 | 3 | 4 | 5`, contracts.ts) — a rank, not a
 * measurement. Nothing here has a unit.
 *
 * WHAT IT DECLARES: the structure (a mark, an identity column that absorbs the
 * slack, a timestamp, two action groups, one overflow affordance) and, for every
 * part of it, what matters least and what to do when the room runs out.
 *
 * WHAT IT DOES NOT DECIDE: a single width. There is no narrow branch, no
 * `compact` variant and no "mobile row". The same source produces the widest
 * layout and the narrowest one, and the reason it can is that `data-fit` is a
 * QUERY container — everything inside resolves against the space this row was
 * actually given, never against the viewport. That is why the identical
 * declaration is correct in a full-bleed page column and in a sidebar, which
 * a viewport breakpoint cannot be.
 *
 * THE DECLARED LADDER, and every rung of it was decided by measurement in a real
 * browser rather than copied. The prototype
 * (`experiments/c11-appearance/src/ui/patterns/message-row.ts`) supplied the
 * reasoning; two of its choices did not survive contact with this content, and
 * both corrections are recorded below and on /intent/comparison.
 *
 *   5  excerpt    hide      SEE "ONE TRUNCATOR" BELOW. The prototype truncates
 *                           its excerpt, and that is right in isolation — prose
 *                           ellipsises without becoming a lie. It is wrong as
 *                           the SECOND truncator in one row, measured.
 *   5  unread dot hide      pure decoration, deliberately the SAME rung as the
 *                           excerpt: both are free to lose, neither before the
 *                           other.
 *   4  timestamp  hide      F5. This was `truncate` in the prototype's first
 *                           run and at the narrowest width the timestamps
 *                           degraded to "1…", "Y…", "M" — technically fitting,
 *                           informationally worthless. A time is an ATOMIC
 *                           value: readable, or gone.
 *   3  title      truncate  the row's identity. It may ellipsise; it never
 *                           vanishes. The one truncator.
 *   2  Copy link  menu      moves into the overflow panel, still reachable.
 *   1  Read       menu      last to be spent, and in practice never is.
 *
 * ACTION GROUPS COLLAPSE AS ONE UNIT. A group is a single candidate carrying a
 * single `data-collapse`, so the solver cannot take one control and leave its
 * sibling stranded beside it.
 *
 * ── ONE TRUNCATOR PER CONTAINER, AND WHY THAT IS A MEASURED RULE ────────────
 * With BOTH the title (priority 3) and the excerpt (priority 5) declaring
 * `truncate`, the solver spends both — correctly, in that order — and then
 * flexbox distributes the remaining space between them BY FLEX BASIS, which is
 * their max-content width. The excerpt was the longer string, so the LESS
 * important text kept more pixels than the row's identity. Measured at a 538px
 * container: the four titles rendered as "AD…", "@ni…", "@nisl…", "C11…" while
 * each excerpt still read "Appearanc…". Every rule passed.
 *
 * `data-priority` orders WHEN a strategy is spent. It does not order HOW MUCH
 * space the survivors keep, and there is no declaration that does. So the
 * authoring rule this integration arrived at is: AT MOST ONE `truncate`
 * CANDIDATE PER `[data-fit]`; everything else `hide`s. It is not in the
 * package's documentation and it should be.
 *
 * ── NO `data-grow` ANYWHERE IN THIS ROW, AND THAT IS NOT A STYLE CHOICE ─────
 * This is the sharpest thing measured here. `data-grow` resolves to
 * `flex: 1 1 auto` with the automatic minimum size intact, so a `[data-text]`
 * grow region shrinks to its own min-content — which, because `roles.css:341`
 * makes text `white-space: normal`, is its LONGEST WORD — and the text wraps.
 * Wrapping converts inline overflow into block growth, and `domMetrics`'s
 * overflow predicate is inline-only (`scrollWidth` vs `clientWidth`). So the
 * container reports that it FITS, the solver spends nothing, and the declared
 * truncation is never reached.
 *
 * Measured with the prototype's own shape — `row > stack[data-grow] > title` —
 * at a 346px container: the grow region collapsed to 86.3px (the width of the
 * word "appearance"), the title rendered 10 words down a 131px-tall column, the
 * row reported `data-fit="settled"`, `data-collapsed-count="0"`, scrollWidth 346
 * === clientWidth 346, and `check()` returned PASS · no findings. A row 371px
 * tall where 36px was intended, and every gate agreed.
 *
 * That is F8's exact shape — a container satisfied while its content is
 * destroyed — reappearing in the BLOCK axis, where nothing measures. N660 cannot
 * see it (no crush: the box got what its min-content asked for). N690 cannot see
 * it (10 words on 10 lines is a wrap, not a shred). N620 cannot see it (the row
 * settled). It is the one defect on these three pages that no shipped rule
 * reports, and it is reported on /intent/comparison instead.
 *
 * ── WHY THIS IS PLAIN MARKUP AND NOT A COMPONENT PER PRIMITIVE ──────────────
 * The prototype composed `Avatar()`, `Text()`, `ActionGroup()` — one custom
 * element each — and `packages/intent/theme/structure.css` §0 pays for that with
 * an ENUMERATED list of `app-*` tag names it hands `display: contents`, because
 * "CSS cannot wildcard a tag name". A consumer whose elements are named anything
 * else gets a boxed host between `[data-layout]` and the child that declared
 * `data-grow` / `data-truncate`, and that file's own comment says what it costs:
 * "the whole no-crush block below becomes cosmetic — the F8 hole reopened one
 * level up". `structure.css:476` hard-codes `app-text` the same way.
 *
 * So this surface has NO intervening hosts at all. Every declaration sits on a
 * real element that is a direct child of the container that sizes it, the
 * no-crush block matches exactly what it was written to match, and the site
 * needs no CSS of its own to make intent work. It is also strictly less code.
 *
 * ── WHY THE STACK IS FLAT, AND THIS ONE IS A MEASURED DEFECT ────────────────
 * The prototype's MessageRow and the package README's own example both nest the
 * truncating title one level deeper — `stack > row > title` — so the unread dot
 * can sit beside it. That shape DOES NOT SHRINK, and it was measured here
 * rather than reasoned about.
 *
 * `structure.css:461-477` exists for exactly this hazard: a truncating node its
 * parent STRETCHES is not sized by flex-basis, so its `nowrap` content sets the
 * grow region's min-content and the grow region then refuses to shrink at all.
 * The fix is `contain: inline-size`, and the selector granting it is
 * `:is([data-layout='stack'], [data-layout='grid']) > [data-truncate]` plus one
 * spelling for a single `app-text` host. Both are DIRECT-child selectors. A
 * title inside a `data-layout="row"` inside the stack is two levels down and
 * receives nothing.
 *
 * Measured on this page, at a 538px container, before the stack was flattened:
 * the grow region pinned at 500px against 442.6px of available space, the row
 * reported `data-fit="unsatisfiable"` and 595/538 — after spending EVERY
 * declared degradation, including both action groups. Two of the four rows did
 * it. The excerpt, a direct child of the stack, had `contain: inline-size` and
 * min-content 0; the title, one level deeper, had `min-inline-size: 0` and a
 * min-content of its entire 500px nowrap string.
 *
 * So the stack here holds title and excerpt as DIRECT children and the unread
 * dot moved out to the row, beside the timestamp — where it reads better anyway
 * ("unread, two hours ago"). That is a legitimate authoring choice and it is
 * also a workaround for a real gap: the grant is written for a shape one level
 * shallower than the shape the package's own documentation demonstrates. The
 * prototype never saw it because its titles were people's names; ours are ADR
 * titles, and 61 characters is what makes the floor visible.
 *
 * DOM-free: the router lazily imports the page barrel (ADR 0026 §8) and this
 * module is on that path. It is a pure markup function, which is also what lets
 * the SSG static tier and the hydrated live tier render from ONE source and
 * differ only by the solved state.
 */
import { html, type TemplateResult } from '@nisli/core';
import { FEED_ACTIONS, type FeedEntry } from './feed.js';

/**
 * The panel id is DERIVED from the scope and the entry, never from a counter.
 * `commandfor` needs a target to point at, which is the one id in the pattern;
 * a counter would number the SSG pass and the hydrated pass differently and the
 * two DOMs would stop being comparable, which is the one thing this page is for.
 */
function panelId(scope: string, entry: FeedEntry): string {
  return `${scope}-${entry.id}-more`;
}

/**
 * One action, rendered identically in the row and in the overflow panel — the
 * same record both times, so a collapsed action cannot drift from its
 * in-row twin.
 */
function Action(label: string, emphasis: string): TemplateResult {
  return html`<button type="button" data-appearance="action" data-role=${emphasis}>${label}</button>`;
}

/**
 * THE ROW. Every attribute below is either the closed vocabulary
 * (`AXIS_ATTRS` × `VOCABULARY`) or one of the four structural declarations the
 * package documents: `data-fit`, `data-grow`, `data-priority`, `data-collapse`.
 */
export function IntentFeedRow(entry: FeedEntry, scope: string): TemplateResult {
  const id = panelId(scope, entry);
  return html`<div data-fit data-layout="row" data-align="center">
    <span data-appearance="avatar" aria-hidden="true">${entry.mark}</span>

    <span data-text="title" data-collapse="truncate" data-priority="3">${entry.title}</span>

    <span data-text="meta" data-collapse="hide" data-priority="5">${entry.excerpt}</span>

    ${entry.unread
      ? html`<span
          data-text="meta"
          data-collapse="hide"
          data-priority="5"
          role="img"
          aria-label="Unread"
          >&#9679;</span
        >`
      : ''}

    <span data-text="meta" data-collapse="hide" data-priority="4">${entry.time}</span>

    ${FEED_ACTIONS.map(
      (action) => html`<div
        data-layout="row"
        data-collapse="menu"
        data-priority=${String(action.priority)}
      >
        ${Action(action.label, action.emphasis)}
      </div>`,
    )}

    <span data-overflow-anchor>
      <button
        type="button"
        data-overflow
        data-appearance="action"
        data-role="quiet"
        command="toggle-popover"
        commandfor=${id}
        aria-haspopup="menu"
        aria-label=${`More actions for ${entry.title}`}
      >
        &#8943;
      </button>
      <div id=${id} popover="auto" data-overflow-menu data-layout="stack">
        ${FEED_ACTIONS.map((action) => Action(action.label, action.emphasis))}
      </div>
    </span>
  </div>`;
}

/**
 * The list. `data-flush` is what makes a surface hold edge-to-edge content: its
 * own padding would double each row's, and the clip is what keeps the rows'
 * square corners inside the rounded frame.
 */
export function IntentFeed(entries: readonly FeedEntry[], scope: string): TemplateResult {
  return html`<div data-appearance="surface" data-flush data-layout="stack">
    ${entries.map((entry) => IntentFeedRow(entry, scope))}
  </div>`;
}

/**
 * The smallest honest example, as a surface rather than as a code block: one
 * row, one context, nothing to drive. The pitch page shows this beside the
 * source that produced it.
 */
export function IntentFeedSample(entry: FeedEntry, scope: string): TemplateResult {
  return html`<div data-theme="light" data-density="comfortable" data-input="pointer">
    ${IntentFeed([entry], scope)}
  </div>`;
}
