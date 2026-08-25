/**
 * Cross-document view transitions for static builds (zero runtime JS).
 *
 * A cross-document transition only runs when *both* the outgoing and the
 * incoming document opt in with `@view-transition { navigation: auto }`. A page
 * therefore cannot opt its own inbound navigations in, which is exactly why
 * this lives in the build rather than in authoring: the build is the only layer
 * that sees every page.
 *
 * Everything emitted here degrades to today's behaviour where unsupported —
 * an engine without `@view-transition` ignores the unknown at-rule and performs
 * a normal navigation, and an engine without the Speculation Rules API treats
 * the script element as inert. Nothing needs removing later.
 *
 * Per-page `view-transition-name`s stay authoring-side CSS: `match-element` is
 * same-document-only, so cross-document names must be explicit anyway.
 */

/** Speculation-rules eagerness hint (`immediate` … `conservative`). */
export type SpeculationEagerness = 'immediate' | 'eager' | 'moderate' | 'conservative';

/** Tuning for the emitted `<script type="speculationrules">` document rules. */
export interface StaticSiteSpeculationRules {
  /** URL Pattern scope applied to both rule sets. Default `'/*'`. */
  hrefMatches?: string | readonly string[];
  /** Prefetch rule: `false` omits it, `true` uses the default eagerness. Default `'moderate'`. */
  prefetch?: boolean | SpeculationEagerness;
  /** Prerender rule: `false` omits it, `true` uses the default eagerness. Default `'moderate'`. */
  prerender?: boolean | SpeculationEagerness;
  /**
   * Links excluded from *prerendering* through `not: { selector_matches }`.
   * `false` drops the exclusion. Default `'[data-no-prerender]'`. Prefetch is
   * not filtered: opting a link out of a hidden pre-rendered document does not
   * mean opting it out of a plain response download.
   */
  excludeSelector?: string | readonly string[] | false;
}

/** Object form of the {@link StaticSiteViewTransitions} option. */
export interface StaticSiteViewTransitionsConfig {
  /**
   * Emit speculation rules alongside the transition opt-in. Off by default;
   * `true` uses the defaults, an object tunes them.
   */
  speculationRules?: boolean | StaticSiteSpeculationRules;
}

/**
 * `true` emits the plain cross-document crossfade opt-in; the object form adds
 * speculation-rule tuning on top of it. Absent or `false` changes nothing.
 */
export type StaticSiteViewTransitions = boolean | StaticSiteViewTransitionsConfig;

const DEFAULT_HREF_MATCHES = '/*';
const DEFAULT_EAGERNESS: SpeculationEagerness = 'moderate';
const DEFAULT_EXCLUDE_SELECTOR = '[data-no-prerender]';

const VIEW_TRANSITION_STYLE = '<style>@view-transition { navigation: auto; }</style>';

type SpeculationCondition =
  | { href_matches: string | readonly string[] }
  | { selector_matches: string | readonly string[] }
  | { not: SpeculationCondition }
  | { and: readonly SpeculationCondition[] };

interface SpeculationRule {
  where: SpeculationCondition;
  eagerness: SpeculationEagerness;
}

function eagerness(value: boolean | SpeculationEagerness | undefined): SpeculationEagerness | null {
  if (value === undefined || value === true) return DEFAULT_EAGERNESS;
  if (value === false) return null;
  return value;
}

/**
 * Object keys are written in a fixed order and the payload is minified, so the
 * emitted bytes are stable across builds — this output is committed.
 */
function speculationRulesJson(options: StaticSiteSpeculationRules): string | null {
  const prefetch = eagerness(options.prefetch);
  const prerender = eagerness(options.prerender);
  if (!prefetch && !prerender) return null;

  const scope: SpeculationCondition = { href_matches: options.hrefMatches ?? DEFAULT_HREF_MATCHES };
  const exclude = options.excludeSelector ?? DEFAULT_EXCLUDE_SELECTOR;
  const rules: { prefetch?: SpeculationRule[]; prerender?: SpeculationRule[] } = {};

  if (prefetch) {
    rules.prefetch = [{ where: scope, eagerness: prefetch }];
  }
  if (prerender) {
    // A `where` object carries exactly one predicate, so an exclusion has to be
    // combined through `and` rather than sitting beside `href_matches`.
    rules.prerender = [{
      where: exclude === false ? scope : { and: [scope, { not: { selector_matches: exclude } }] },
      eagerness: prerender,
    }];
  }
  return JSON.stringify(rules);
}

/**
 * Head markup for a build's `viewTransitions` option; `''` when disabled, which
 * is what keeps an opted-out build byte-identical to today's output.
 */
export function renderViewTransitionHead(options: StaticSiteViewTransitions | undefined): string {
  if (!options) return '';

  const parts = [VIEW_TRANSITION_STYLE];
  const speculationRules = options === true ? undefined : options.speculationRules;
  if (speculationRules) {
    const json = speculationRulesJson(speculationRules === true ? {} : speculationRules);
    // `<script>` is a raw-text element: an unescaped `</script` or `<!--` in the
    // payload would terminate it. `\u003C` round-trips through JSON.parse and
    // never appears in the default rules, so common output is unaffected.
    if (json) parts.push(`<script type="speculationrules">${json.replace(/</g, '\\u003C')}</script>`);
  }
  return parts.join('\n');
}

const HEAD_CLOSE = /([ \t]*)<\/head\s*>/i;

/**
 * Inserts {@link renderViewTransitionHead} output into a rendered page.
 *
 * Indentation of the closing tag is reused so the injected lines sit flush with
 * the surrounding shell, keeping the diff of a committed build readable.
 *
 * A page WITHOUT a closing `</head>` is a hard error rather than a guess. This
 * markup only works in the head: prepending it to a document would land content
 * before `<!doctype html>` and force quirks mode, and prepending it to a
 * fragment that a shell later embeds puts a `<style>` and a speculation-rules
 * `<script>` in the `<body>`, where the cross-document opt-in does nothing —
 * measured in a real build. A shell that composes its own document should call
 * {@link renderViewTransitionHead} directly and place the block itself.
 */
export function injectViewTransitionHead(html: string, head: string, path: string): string {
  if (!head) return html;

  const close = HEAD_CLOSE.exec(html);
  if (!close) {
    throw new Error(
      `viewTransitions requires a closing </head> in rendered output: ${path}. `
      + `A shell that returns a fragment or composes its own document should call `
      + `renderViewTransitionHead() and place the block in the head itself.`,
    );
  }
  const indent = close[1] ?? '';
  const block = head.split('\n').map(line => `${indent}${line}`).join('\n');
  return `${html.slice(0, close.index)}${block}\n${html.slice(close.index)}`;
}
