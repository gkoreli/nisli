/**
 * intent/tailwind-surface.ts — THE CONTROL. The same feed, authored the way the
 * rest of this site is authored.
 *
 * THIS FILE IS DELIBERATELY FULL OF CLASS NAMES, HAND-PICKED VALUES AND A
 * BREAKPOINT. That is the point of it, and it is the one file in
 * `src/intent/**` exempt from the no-values guard — the guard names it as an
 * exemption rather than skipping it silently, so the exemption is auditable.
 *
 * ── IT IS NOT RIGGED, AND HERE IS THE EVIDENCE OF THAT ─────────────────────
 * Every utility below is one this site already uses on a real page. It is a
 * competent row: `min-w-0 flex-1` on the identity column so it is the thing that
 * absorbs the slack, `truncate` on both text nodes so the loss has an ellipsis
 * as its receipt, `shrink-0` on the mark, the timestamp and the action strip so
 * nothing gets crushed, `size-9` and `h-8` for controls, `divide-y` for the
 * rules between rows, and `hidden sm:inline` / `hidden sm:flex` to drop the
 * timestamp and the actions on small screens. If you asked a good developer for
 * this row, you would get approximately this.
 *
 * A REVIEWER WOULD PASS IT. The checker's verdict on it is recorded on
 * /intent/comparison, run in a real browser, whichever way it fell — and it did
 * not fall the way a marketing page would have wanted. Read the page.
 *
 * ── THE ONE THING WORTH SAYING UP FRONT ────────────────────────────────────
 * `sm:` is a VIEWPORT media query — Tailwind's `sm` is a `min-width` on the
 * viewport, not on this row's container. So the two `hidden sm:*` decisions are
 * correct exactly when the row's container is about as wide as the window, and
 * wrong whenever it is not: in a sidebar, in a split pane, in a narrow column of
 * a wide page. That is not a Tailwind defect and it is not news — it is why
 * container queries exist, and Tailwind v4 ships `@container` variants for it
 * (`@nisli/ui`'s own `form-field.ts` and `card.ts` use them). A developer who
 * reached for those would fix this half of it.
 *
 * What `@container` would NOT fix, and what the comparison is actually about:
 * the width at which the timestamp goes is still a number somebody typed, the
 * ORDER things are given up in is still implied by markup rather than declared,
 * and the row still cannot know that it is in a touch context or a dense one.
 * /intent/comparison says which of the checker's findings survive a `@container`
 * rewrite and which do not, instead of leaving the reader to assume.
 */
import { html, type TemplateResult } from '@nisli/core';
import { FEED_ACTIONS, type FeedEntry } from './feed.js';

/** The site's own small-control recipe, the same shape `buttonVariants` produces.
 *
 * BOTH ACTIONS ARE QUIET, and the reason is in `feed.ts`: the intent half's first
 * version painted "Read" as `primary` on every row and the checker reported
 * N700 — a list is not a decision point, and the prototype's own inbox makes
 * every per-row action quiet for the same reason. The design change was applied
 * to BOTH halves, because a comparison in which the two halves are different
 * designs is not a comparison. Note what that means for this file: the fix was
 * found on the intent half, by a machine, and then hand-applied here — nothing
 * would ever have told us about this side. */
const BUTTON =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const BUTTON_QUIET = `${BUTTON} text-muted-foreground hover:bg-accent hover:text-accent-foreground`;

function TailwindFeedRow(entry: FeedEntry): TemplateResult {
  return html`<div class="flex items-center gap-2 px-4 py-2">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
      aria-hidden="true"
    >
      ${entry.mark}
    </div>

    <span class="min-w-0 flex-1 truncate text-sm font-medium">${entry.title}</span>

    <span class="hidden shrink-0 text-xs text-muted-foreground lg:inline">${entry.excerpt}</span>

    ${entry.unread
      ? html`<span
          class="size-1.5 shrink-0 rounded-full bg-foreground"
          role="img"
          aria-label="Unread"
        ></span>`
      : ''}

    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">${entry.time}</span>

    <div class="hidden shrink-0 items-center gap-1 sm:flex">
      ${FEED_ACTIONS.map(
        (action) => html`<button type="button" class=${BUTTON_QUIET}>${action.label}</button>`,
      )}
    </div>
  </div>`;
}

export function TailwindFeed(entries: readonly FeedEntry[]): TemplateResult {
  return html`<div class="divide-y overflow-hidden rounded-xl border bg-card">
    ${entries.map((entry) => TailwindFeedRow(entry))}
  </div>`;
}
