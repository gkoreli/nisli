/**
 * intent/feed.ts — the CONTENT the intent surfaces render, and nothing else.
 *
 * Separated from every surface file for one reason: the comparison page renders
 * the same rows twice, once declared in the intent vocabulary and once authored
 * in Tailwind, and a comparison where the two halves render different content
 * is not a comparison. One corpus, two authoring styles, identical text.
 *
 * The content is real: these are this repository's own recent decisions and
 * releases. A reader who does not care how the row is built still gets a
 * useful project feed out of the page, which is the difference between a
 * product surface and a vocabulary demo.
 *
 * The rows are deliberately AWKWARD, the same way the prototype's corpus was
 * (`experiments/c11-appearance/src/app/state.ts`): long titles, long excerpts,
 * one entry whose title is wider than the rest, two action groups and a
 * timestamp. Content that fits at every width proves nothing — the degradation
 * ladder is only observable when something actually has to be spent.
 *
 * DOM-free on purpose: `src/intent/index.ts` is lazily imported by the router
 * (ADR 0026 §8) and this module is on that path, so nothing here may touch
 * `HTMLElement` or call `component()`.
 */
import type { Emphasis, Priority } from '@nisli/intent';


export interface FeedEntry {
  /** Stable, and used to derive the row's popover id — so no counter is needed. */
  id: string;
  /** Initials for the avatar. The avatar role derives its own size. */
  mark: string;
  /** The row's identity. May ellipsise; never vanishes. */
  title: string;
  /** Prose. The cheapest thing to give up, so it truncates first. */
  excerpt: string;
  /** Atomic: readable or gone. F5 — this is why it declares `hide`, not `truncate`. */
  time: string;
  /** Decoration, and the same rung as the excerpt: both free to lose. */
  unread: boolean;
}

export const FEED: readonly FeedEntry[] = [
  {
    id: 'adr-0032',
    mark: 'AD',
    title: 'ADR 0032 — derived appearance becomes a permanent peer package',
    excerpt: 'Accepted, with its counter-evidence',
    time: '2h',
    unread: true,
  },
  {
    id: 'intent-theme',
    mark: 'IN',
    title: '@nisli/intent — the resolution table ships as four layered files',
    excerpt: 'states.css is unlayered on purpose',
    time: 'yesterday',
    unread: true,
  },
  {
    id: 'core-055',
    mark: 'CO',
    title: '@nisli/core 0.55 — signals, templates, components, DI',
    excerpt: 'Still no CSS, still no build step',
    time: '3 days',
    unread: false,
  },
  {
    id: 'c11-proof',
    mark: 'C1',
    title: 'C11 prototype — 240 of 240 context combinations clean in Chromium',
    excerpt: 'Ten independent assertion paths',
    time: 'last week',
    unread: false,
  },
];

/**
 * One action per entry, ordered, and PRIORITY IS NOT EMPHASIS.
 *
 * Both fields come from the package's own types, so neither can drift from the
 * vocabulary. Keeping them separate is not fastidiousness — conflating them is
 * what produced the only failing finding this integration recorded.
 *
 * MEASURED, and the reason both actions are `quiet`. The first version painted
 * "Read" as `primary` on every row, and the checker reported, on the intent half
 * of /intent/comparison:
 *
 *   FAIL N700 · 8 actions in one surface declare priority — attention cannot be
 *   spent twice
 *
 * Two facts came out of chasing that, and both are on the comparison page:
 *
 *   1. Eight, for four buttons a reader can see. The other four are the
 *      duplicates inside the CLOSED overflow panels — which exist by
 *      construction, because the `menu` strategy keeps a collapsed action
 *      reachable by putting a twin in the panel. Measured: 8 matched, 4 with
 *      0x0 rects and `checkVisibility()` false. N700 selects through
 *      `declared()`, not `painted()`, so any row declaring `data-collapse="menu"`
 *      doubles its own contribution to this rule.
 *   2. The rule is nonetheless RIGHT about the design, and the prototype agrees
 *      with it: every per-row action in `experiments/c11-appearance/src/app/
 *      pages/inbox.ts` is `quiet`, and the single `primary` in that page is the
 *      toolbar's "New message". A list is not a decision point. No row in a feed
 *      is "the thing to do", so no row gets to say it is.
 *
 * Priority is what survives; emphasis is what it looks like. "Read" is
 * priority 1 — last to be spent, never lost — and still quiet.
 */
export interface FeedAction {
  label: string;
  /** 1 survives longest, 5 degrades first. */
  priority: Priority;
  /** How it PAINTS. Independent of what survives. */
  emphasis: Emphasis;
}

export const FEED_ACTIONS: readonly FeedAction[] = [
  { label: 'Copy link', priority: 2, emphasis: 'quiet' },
  { label: 'Read', priority: 1, emphasis: 'quiet' },
];
