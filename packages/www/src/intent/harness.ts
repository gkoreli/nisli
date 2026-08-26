/**
 * intent/harness.ts — the CONTROLS, and the one file in `src/intent/**` that
 * contains a number.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ THE NUMBERS BELOW ARE HARNESS GEOMETRY, NOT STYLING. They size the RULER   ║
 * ║ the surface is measured in, never the surface. Nothing derives an          ║
 * ║ appearance from them and nothing inside a `[data-fit]` container can see   ║
 * ║ them: the container query reads the width it was GIVEN, whatever gave it.  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * This is the same distinction, and the same wording, the prototype's harness
 * had to make (`experiments/c11-appearance/src/app/state.ts`: "The only numbers
 * in src/app. They are HARNESS GEOMETRY, not styling"). It is recorded loudly
 * because it is the obvious place to cheat, and because it IS a real gap in the
 * vocabulary worth stating plainly rather than hiding:
 *
 *   THE VOCABULARY HAS NO WIDTH AXIS, DELIBERATELY. `packages/intent/theme/
 *   tokens.css` opens with it — "a viewport width is not a design intent, and a
 *   breakpoint is a guess about one". So the vocabulary can express what a thing
 *   IS and what matters LEAST, and it cannot express "put this in a 360-wide
 *   slot", because that is a fact about the page's own layout rather than about
 *   the component. A demo that wants to show one declaration surviving five
 *   widths therefore has to type five widths SOMEWHERE, and the honest place is
 *   here, in the instrument, one table, labelled.
 *
 * Every control below is itself declared in the intent vocabulary — no classes,
 * no colours, no sizes. The switchers are the one place on the site where the
 * chrome and the subject are authored in the same words, which is a small piece
 * of evidence on its own: the vocabulary is not a special dialect for feed rows.
 */
import {
  computed,
  html,
  signal,
  type ReadonlySignal,
  type Signal,
  type TemplateResult,
} from '@nisli/core';
import type { Density, InputMode, ThemeName } from '@nisli/intent';
import { VOCABULARY } from '@nisli/intent';

/* ── The context axes. Values come from the package, never retyped ────────── */

export const density = signal<Density>('comfortable');
export const input = signal<InputMode>('pointer');

/**
 * THE THEME AXIS CANNOT FOLLOW THIS SITE'S DARK MODE BY ITSELF, and that is a
 * package Limit rather than a bug in either half.
 *
 * nisli.dev flips theme with a `dark` CLASS on `<html>` (`styles/input.css`:
 * `@custom-variant dark (&:where(.dark, .dark *))`). intent's theme axis is a
 * `data-theme` ATTRIBUTE. The two are independent, so a reader in site dark mode
 * got a dark page with WHITE intent surfaces in it — measured on
 * /intent/playground before this line existed: body `oklch(0.145 0 0)`, surface
 * `rgb(255,255,255)`, text `rgb(17,17,20)`.
 *
 * THE BRIDGE THAT DOES NOT WORK, measured and rejected rather than assumed:
 * writing `data-theme="dark"` on `<html>` from the site's toggle fixes nothing
 * here, because these surfaces sit inside this harness's own `[data-theme]`
 * wrapper and the nearest declaration correctly wins — and it costs 23 changed
 * colour properties on site chrome, because `[data-theme]` carries
 * `color: var(--intent-fg)` which then inherits into every chrome anchor and
 * button. So the bridge is both ineffective and a bleed.
 *
 * What works is what is below: READ the site's preference, then let the buttons
 * override it. `readSiteTheme` is guarded because this module is evaluated by the
 * static build too (happy-dom), where the class is absent and `light` is right.
 * `island.ts` keeps it in sync afterwards.
 */
export function readSiteTheme(): ThemeName {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export const theme = signal<ThemeName>(readSiteTheme());

/**
 * THE RULER. `null` means "the slot the page gave it"; a number emulates a slot
 * of that width without touching the viewport, which is the whole point — a
 * container query answers to the box it is in, so the window never has to move.
 *
 * The five numbers are the prototype's measured set, kept identical so a reading
 * here is comparable with the 240-cell matrix rather than a new axis nobody has
 * data for. They are slot widths in CSS pixels.
 */
export const RULER_WIDTHS: readonly number[] = [1080, 720, 480, 360, 320];

/**
 * ONE RULER PER SURFACE, with a default chosen by MEASUREMENT rather than taste.
 * Both are non-`null` on purpose: a demo that opens in the state where nothing
 * has had to be spent shows the reader an engine doing nothing, and the proof
 * script measuring it reads a vacuous zero.
 *
 * Measured in Chromium at a 1440 viewport, over the four rows on each page:
 *
 *   playground  360  one column of 358 -> 5 mutator writes, 3 menu collapses
 *   comparison  720  TWO columns of 346 -> 7 mutator writes, 4 menu collapses,
 *                    which is also the narrowest setting that still puts the
 *                    two halves side by side rather than stacking them.
 *
 * `page` is one click away in both, and it is the honest zero: at a 538px column
 * every row fits unsolved and the engine correctly spends nothing.
 */
export const playgroundRuler = signal<number | null>(360);
export const comparisonRuler = signal<number | null>(720);

/* ── The controls ─────────────────────────────────────────────────────────── */

/**
 * Uncontrolled on purpose: the signal is the source of truth and the pressed
 * state is derived from it, so a control cannot disagree with what is on screen.
 * `aria-pressed` rather than a colour, because the fact being communicated is a
 * state and not a shade.
 */
function Switch<T extends string | number | null>(
  label: string,
  options: readonly T[],
  current: ReadonlySignal<T>,
  apply: (value: T) => void,
  render: (value: T) => string,
): TemplateResult {
  return html`<div data-layout="wrap" data-align="center">
    <span data-text="label">${label}</span>
    ${options.map(
      (option) => html`<button
        type="button"
        data-appearance="action"
        data-role=${computed(() => (current.value === option ? 'primary' : 'quiet'))}
        aria-pressed=${computed(() => (current.value === option ? 'true' : 'false'))}
        @click=${() => apply(option)}
      >
        ${render(option)}
      </button>`,
    )}
  </div>`;
}

/**
 * The four switchers, over ONE surface that never changes. Density, input mode
 * and theme are read straight out of `VOCABULARY`, so a switcher cannot offer a
 * value the package does not accept — the same reason the vocabulary table on
 * /intent is derived rather than typed.
 */
export function ContextSwitchers(ruler: Signal<number | null>): TemplateResult {
  return html`<div
    data-layout="wrap"
    data-align="center"
    data-density="compact"
    data-input="pointer"
    data-theme=${theme}
  >
    ${Switch(
      'density',
      VOCABULARY.density,
      density,
      (value) => (density.value = value),
      (value) => value,
    )}
    ${Switch(
      'input',
      VOCABULARY.input,
      input,
      (value) => (input.value = value),
      (value) => value,
    )}
    ${Switch(
      'theme',
      VOCABULARY.theme,
      theme,
      (value) => (theme.value = value),
      (value) => value,
    )}
    ${Switch<number | null>(
      'width',
      [null, ...RULER_WIDTHS],
      ruler,
      (value) => (ruler.value = value),
      (value) => (value === null ? 'page' : String(value)),
    )}
  </div>`;
}

/**
 * The declared context, applied. Three attributes on one element; every value
 * inside resolves from them plus the space the element was given.
 *
 * `data-theme` is what makes the theme switcher legal without a second colour
 * table: any axis that touches the foreground owns the backdrop too, which is
 * the general rule the prototype's F3 bought — dark text tokens with no
 * background of their own measured 1.10:1, light-on-white, and no human had
 * noticed.
 */
export function ContextScope(content: TemplateResult): TemplateResult {
  return html`<div
    data-theme=${theme}
    data-density=${density}
    data-input=${input}
    data-layout="stack"
  >
    ${content}
  </div>`;
}

/**
 * The ruler. An inline `inline-size` on a wrapper OUTSIDE the fit container:
 * the only length this module writes into the document, and it sizes the slot
 * rather than anything in it. `page` writes nothing at all.
 */
export function Ruler(ruler: Signal<number | null>, content: TemplateResult): TemplateResult {
  return html`<div
    data-slot="intent-ruler"
    style=${computed(() => (ruler.value === null ? '' : `inline-size:${ruler.value}px;max-inline-size:100%`))}
  >
    ${content}
  </div>`;
}

/**
 * The theme switcher, translated into the SITE's own mechanism, for the half of
 * the comparison that cannot read a context axis.
 *
 * This is the fairness declaration of the whole comparison and it is worth being
 * explicit about. nisli.dev flips theme with a `dark` class
 * (`styles/input.css`: `@custom-variant dark (&:where(.dark, .dark *))`, and
 * `nisli-ui/styles/theme.css` resolves every token through `light-dark()`), so
 * the Tailwind half gets the theme axis through the exact mechanism a developer
 * on this site would use, applied to the same subtree, from the same switcher.
 *
 * It gets NOTHING for density or input mode, and that is not a handicap this
 * page imposed: there is no site-wide mechanism to give it. The site has one
 * spacing scale and one control height, so "compact" and "touch" are not states
 * a Tailwind surface here can be in. That asymmetry IS the comparison, and
 * stating it is the difference between a finding and a rigged demo.
 */
export const siteThemeClass: ReadonlySignal<string> = computed(() =>
  theme.value === 'dark' ? 'dark bg-background text-foreground' : 'bg-background text-foreground',
);
