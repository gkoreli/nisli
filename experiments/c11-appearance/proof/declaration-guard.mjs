#!/usr/bin/env node
/**
 * declaration-guard.mjs — the resolution table checks its own declarations.
 *
 * `test/reachability.test.ts` asks whether a rule's SELECTOR can match
 * something that exists. It has no opinion about whether a DECLARATION can
 * take effect. This is its sibling for the other half, and it exists because
 * two declarations in this table resolved to something other than what they
 * said, measured hours apart, both the same shape:
 *
 *   overflow-clip-margin: calc(var(--unit) / 2)   silently REJECTED, computes
 *                                                 to the initial value
 *   overflow-y: clip  beside  overflow-x: auto    computes to `hidden`
 *
 * Every net this experiment had was blind to both, and blind in the expensive
 * direction: `no-values-guard.mjs` passes because there is no literal to find
 * (the value is genuinely derived — it simply does not arrive), `tsc` passes
 * because it is CSS, and the 240-cell matrix passes because a declaration that
 * does nothing is not a defect anybody declared. The value LOOKS derived, the
 * guard sees no literal, and the declaration has no effect. That is success by
 * silence, one layer below the N700 dead-selector bug, inside the largest
 * single part of the bet.
 *
 * Three classes, and the honest scope of each is the point of this file:
 *
 *   A  REJECTED   the declaration cannot parse as a value for its property,
 *                 after the custom properties it names are substituted with
 *                 what they actually resolve to in the context. Decided by
 *                 `CSS.supports()` in real Chromium. FAILS the run.
 *   B  COERCED    a declared bare KEYWORD computes to a DIFFERENT keyword,
 *                 with the rule's own declaration block applied. FAILS the
 *                 run. §Class B explains what is deliberately not reported.
 *   C  UNMATCHED  a theme selector that matched nothing in any exercised
 *                 context. WARNS only, and §Class C explains why it cannot
 *                 honestly do more than warn.
 *
 * It starts nothing. Point it at a running dev server:
 *
 *   pnpm --filter @nisli/experiment-c11-appearance dev   # in another shell
 *   node proof/declaration-guard.mjs
 *   node proof/declaration-guard.mjs --self-test
 *
 * `--self-test` is the guard on the guard: it injects each defect class into
 * the parsed model — never into `src/` — and requires the guard to report the
 * broken spelling and stay silent on the fixed one, in that order. A check
 * that has never been observed to fail is decoration.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY COMMENTS ARE STRIPPED FIRST, AND WHY THAT IS LOAD-BEARING HERE.
 * ══════════════════════════════════════════════════════════════════════════
 * The same reason `reachability.test.ts` strips them: this table deliberately
 * quotes the declarations that were wrong. `structure.css` writes out all four
 * spellings of the clip margin, including the rejected one, and states that
 * `overflow-y: clip` computes to `hidden`. A scan that read comments would
 * report both defects out of the prose explaining that they are defects, and
 * the guard would fail on its own institutional memory. Comments are replaced
 * by their own newlines so reported line numbers stay true.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The resolution table. The only place in the experiment that holds values. */
const THEME = 'src/theme';

/**
 * Token contexts for classes A and B. These are set on the guard's own probe
 * element rather than on the app, because what a declaration resolves to is a
 * function of the axes above it and nothing else — so the whole axis space is
 * reachable without touching the page or reloading anything.
 *
 * All three axes are declared on the probe together, which is also what makes
 * every token in the table resolvable: an unresolvable custom property is
 * reported as undecidable rather than guessed at.
 */
const DENSITIES = ['comfortable', 'compact', 'dense'];
const INPUTS = ['pointer', 'touch'];
const THEMES = ['light', 'dark'];

/**
 * Contexts for class C. Here the PAGE matters, because the question is which
 * elements exist — and the narrow widths matter because the solver writes
 * `data-truncate`, `data-collapsed`, `data-hidden` and `data-shown` only under
 * pressure. A guard that asked this at one wide viewport would call every
 * degradation rule dead.
 *
 * The axis combinations below are not decoration either, and the first run of
 * this guard proved it: with every context pinned to light, `[data-theme=dark]`
 * was reported as an unmatched selector — which was a fact about the guard's
 * own context list and nothing else. A guard reporting an artefact of its own
 * blind spot is worse than one reporting nothing, so between them these three
 * cover every value of all three axes.
 */
const AXIS_TRIPLES = [
  { density: 'comfortable', input: 'pointer', theme: 'light' },
  { density: 'dense', input: 'touch', theme: 'dark' },
  { density: 'compact', input: 'pointer', theme: 'dark' },
];

/**
 * The pages are read from `src/app/state.ts` rather than listed here, and that
 * is a vacuity fix rather than tidiness: a page added to the harness after this
 * file was written would never be visited, so every selector only that page
 * reaches would be reported unmatched — the guard inventing findings out of its
 * own staleness. An empty list is a broken self-check, never an empty run.
 */
const PAGE_SOURCE = 'src/app/state.ts';

async function readPages() {
  const source = await readFile(path.join(ROOT, PAGE_SOURCE), 'utf8');
  const list = source.match(/PAGE_IDS[^=]*=\s*\[([^\]]*)\]/);
  return list ? [...list[1].matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]) : [];
}

function reachContexts(pages) {
  const contexts = [];
  for (const page of pages) {
    for (const width of [1080, 320]) {
      for (const axes of AXIS_TRIPLES) contexts.push({ page, width, ...axes });
    }
  }
  return contexts;
}

/* ══════════════════════════════════════════════════════════════════════════
   Arguments
   ══════════════════════════════════════════════════════════════════════════ */

const USAGE = 'usage: declaration-guard.mjs [--url URL] [--headed] [--self-test]';

function parseArgs(argv) {
  const options = { url: 'http://127.0.0.1:5199', headed: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const split = arg.indexOf('=');
    const flag = split < 0 ? arg : arg.slice(0, split);
    const inline = split < 0 ? undefined : arg.slice(split + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      i += 1;
      if (argv[i] === undefined) throw new Error(`${flag} needs a value\n${USAGE}`);
      return argv[i];
    };
    switch (flag) {
      case '--url':
        options.url = value();
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--self-test':
        options.selfTest = true;
        break;
      case '--help':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown flag ${flag}\n${USAGE}`);
    }
  }
  return options;
}

/* ══════════════════════════════════════════════════════════════════════════
   The source parser — selectors, declarations and the lines they live on
   ══════════════════════════════════════════════════════════════════════════
   Deliberately not a CSS parser: the browser is the CSS parser, and this run
   cross-checks itself against it (self-check `parser agrees with the browser`).
   What this needs and the CSSOM cannot give is a LINE NUMBER, because a
   finding nobody can locate is a finding nobody fixes.
   ══════════════════════════════════════════════════════════════════════════ */

function stripComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      // Keep the newlines and drop everything else, so line numbers survive.
      out += source.slice(i, stop).replace(/[^\n]/g, '');
      i = stop;
      continue;
    }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      let j = i + 1;
      while (j < source.length && source[j] !== quote) j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, Math.min(j + 1, source.length));
      i = j + 1;
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

/** Comma split that respects `:is(a, b)` and `[attr="a,b"]`. */
function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const IMPORTANT = /!\s*important\s*$/i;

function parseSheet(file, source) {
  const text = stripComments(source);
  const rules = [];
  const stack = [];
  let buffer = '';
  let bufferLine = 1;
  let line = 1;

  const push = (ch) => {
    if (buffer.trim() === '' && ch.trim() !== '') bufferLine = line;
    buffer += ch;
  };
  const take = () => {
    const text = buffer.replace(/\s+/g, ' ').trim();
    buffer = '';
    return text;
  };
  const innermostRule = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].rule) return stack[i].rule;
    return null;
  };
  const flushDeclaration = () => {
    const at = bufferLine;
    const text = take();
    if (!text || text.startsWith('@')) return;
    const colon = text.indexOf(':');
    if (colon < 0) return;
    const rule = innermostRule();
    if (!rule) return;
    let value = text.slice(colon + 1).trim();
    const important = IMPORTANT.test(value);
    if (important) value = value.replace(IMPORTANT, '').trim();
    rule.declarations.push({ line: at, property: text.slice(0, colon).trim(), value, important });
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      push(ch);
      line += 1;
      continue;
    }
    if (ch === '{') {
      const at = bufferLine;
      const prelude = take();
      const frame = { prelude, rule: null };
      if (!prelude.startsWith('@')) {
        frame.rule = {
          file,
          line: at,
          selectorText: prelude,
          selectors: splitSelectors(prelude),
          conditions: stack.filter((entry) => entry.prelude.startsWith('@')).map((entry) => entry.prelude),
          declarations: [],
        };
        rules.push(frame.rule);
      }
      stack.push(frame);
      continue;
    }
    if (ch === '}') {
      flushDeclaration();
      stack.pop();
      continue;
    }
    if (ch === ';') {
      flushDeclaration();
      continue;
    }
    push(ch);
  }
  return rules;
}

/* ══════════════════════════════════════════════════════════════════════════
   The in-page audit — classes A and B. The only code that asks the engine.
   ══════════════════════════════════════════════════════════════════════════ */

function auditInPage(input) {
  const { files, contexts } = input;

  /* THE PROBE. A plain block inside a plain absolutely-positioned block that
     declares all three axes. Two things about it are load-bearing:

     - it declares the axes ITSELF, so every token in the table resolves and
       the whole axis space is reachable without touching the app;
     - it is NOT a flex or grid item, because a flex item's `display` is
       blockified at computed-value time. Measuring `display: inline-flex`
       inside a flex parent would report `block` and class B would call the
       spec a defect — the same "measure the box the claim is about" mistake
       this experiment has recorded six times. */
  const host = document.createElement('div');
  host.style.cssText = 'position: absolute; visibility: hidden; inset-block-start: 0; inset-inline-start: 0;';
  const probe = document.createElement('div');
  const scratch = document.createElement('div');
  host.append(probe, scratch);
  document.body.append(host);

  const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);
  const KEYWORD = /^[a-zA-Z][a-zA-Z0-9-]*$/;

  /* ── var() substitution ────────────────────────────────────────────────
     The whole reason class A exists. `CSS.supports()` accepts ANY value that
     contains `var()`, because substitution happens at computed-value time —
     which is exactly where the clip margin was rejected. So the value has to
     be asked about as the arithmetic it becomes, not as the opaque token
     stream it is written as. A computed custom property arrives already
     substituted — `--unit` resolves to a multiplication of two resolved
     lengths, not to the expression naming the axes that produced them — so one
     pass suffices; the loop is a guard against a future registered property,
     not an expectation. */
  function substitute(value, computed) {
    const unresolved = [];
    let current = value;
    for (let pass = 0; pass < 8 && current.includes('var('); pass++) {
      let out = '';
      let i = 0;
      while (i < current.length) {
        if (current.startsWith('var(', i)) {
          let depth = 0;
          let j = i + 3;
          for (; j < current.length; j++) {
            if (current[j] === '(') depth += 1;
            else if (current[j] === ')') {
              depth -= 1;
              if (depth === 0) break;
            }
          }
          const inner = current.slice(i + 4, j);
          let split = -1;
          let nested = 0;
          for (let k = 0; k < inner.length; k++) {
            if (inner[k] === '(') nested += 1;
            else if (inner[k] === ')') nested -= 1;
            else if (inner[k] === ',' && nested === 0) {
              split = k;
              break;
            }
          }
          const name = (split < 0 ? inner : inner.slice(0, split)).trim();
          const fallback = split < 0 ? null : inner.slice(split + 1).trim();
          const resolved = computed.getPropertyValue(name).trim();
          if (resolved) out += resolved;
          else if (fallback) out += fallback;
          else unresolved.push(name);
          i = j + 1;
          continue;
        }
        out += current[i];
        i += 1;
      }
      current = out;
    }
    return { value: current.replace(/\s+/g, ' ').trim(), unresolved };
  }

  const findings = [];
  const undecidable = [];
  const stats = {
    rules: 0,
    declarations: 0,
    customProperties: 0,
    supportsAnswers: 0,
    uniquePairs: 0,
    substituted: 0,
    keywordsCompared: 0,
    comparisons: 0,
    skippedCssWide: 0,
    skippedPending: 0,
    skippedNonKeyword: 0,
    skippedResolved: 0,
    blocksApplied: 0,
  };
  const supportsCache = new Map();
  const supports = (property, value) => {
    const key = `${property}|${value}`;
    stats.supportsAnswers += 1;
    let answer = supportsCache.get(key);
    if (answer === undefined) {
      answer = CSS.supports(property, value);
      supportsCache.set(key, answer);
      stats.uniquePairs += 1;
    }
    return answer;
  };
  const seen = new Map();
  const report = (into, entry) => {
    /* The same declaration is checked in every context, so one defect is one
       finding with the contexts listed — a guard that multiplies its own output
       gets muted. Measured while building this: keying on the DETAIL instead of
       the kind reported the regressed clip margin six times, once per distinct
       substituted arithmetic, which is exactly the noise the dedup exists to
       stop. The first detail is kept because the substituted value it names is
       real evidence; the rest of the contexts are counted. */
    const key = `${into === findings ? 'f' : 'u'}|${entry.file}:${entry.line}:${entry.property}:${entry.kind}`;
    const existing = seen.get(key);
    if (existing) {
      existing.contexts.push(entry.context);
      return;
    }
    const record = { ...entry, contexts: [entry.context] };
    seen.set(key, record);
    into.push(record);
  };

  for (const context of contexts) {
    host.setAttribute('data-density', context.density);
    host.setAttribute('data-input', context.input);
    host.setAttribute('data-theme', context.theme);
    const label = `${context.density}/${context.input}/${context.theme}`;
    const first = context === contexts[0];
    const computed = getComputedStyle(probe);

    for (const file of files) {
      for (const rule of file.rules) {
        if (first) stats.rules += 1;

        /* ── Class A ─────────────────────────────────────────────────── */
        for (const declaration of rule.declarations) {
          if (first) stats.declarations += 1;
          if (declaration.property.startsWith('--')) {
            // A custom property accepts any token stream, so asking whether it
            // is supported is vacuous. It is checked where it is USED instead,
            // which is what substitution above does — in every context, at
            // every consumer.
            if (first) stats.customProperties += 1;
            continue;
          }
          const { value, unresolved } = substitute(declaration.value, computed);
          if (value !== declaration.value && first) stats.substituted += 1;
          if (unresolved.length > 0) {
            // Cannot be measured, so it is said out loud rather than passed.
            report(undecidable, {
              kind: 'unresolvable-custom-property',
              file: rule.file,
              line: declaration.line,
              selector: rule.selectorText,
              property: declaration.property,
              declared: declaration.value,
              detail: `custom ${unresolved.join(', ')} resolves to nothing here, so the substituted value cannot be tested`,
              context: label,
            });
            continue;
          }
          if (supports(declaration.property, value)) continue;
          const asWritten = supports(declaration.property, declaration.value);
          report(findings, {
            kind: asWritten ? 'rejected-after-substitution' : 'unsupported-as-written',
            class: 'A',
            file: rule.file,
            line: declaration.line,
            selector: rule.selectorText,
            property: declaration.property,
            declared: declaration.value,
            detail: asWritten
              ? `parses as written and is REJECTED once substituted to \`${value}\`, so it computes to its initial value`
              : `is not a supported value for this property`,
            context: label,
          });
        }

        /* ── Class B ─────────────────────────────────────────────────────
           The rule's OWN declaration block, applied inline. Inline style beats
           every layered rule in the table, so what is measured is the block
           and not the cascade — which is the honest scope: this class asks
           whether a block says what it does, never whether another rule
           legitimately overrides it in situ.

           Setting the whole block at once is what makes the `overflow-y`
           defect visible at all: that coercion is an interaction BETWEEN two
           declarations in one block, so a declaration measured alone would
           have looked fine. It also hands the within-block cascade to the
           browser, so an overridden longhand is never compared against the
           declaration that lost. */
        const block = rule.declarations
          .map((d) => `${d.property}: ${d.value}${d.important ? ' !important' : ''};`)
          .join(' ');
        probe.style.cssText = block;
        stats.blocksApplied += 1;
        const inline = probe.style;
        for (let i = 0; i < inline.length; i++) {
          const longhand = inline[i];
          if (longhand.startsWith('--')) continue;
          const declared = inline.getPropertyValue(longhand).trim();
          if (declared === '') {
            // A shorthand carrying a var() is stored whole as a pending
            // substitution, so its longhands have no value to compare. Counted
            // rather than dropped, because a silently shrinking denominator is
            // how a guard stops guarding.
            if (first) stats.skippedPending += 1;
            continue;
          }
          if (CSS_WIDE.has(declared.toLowerCase())) {
            // `inherit` and friends MEAN "compute to something else".
            if (first) stats.skippedCssWide += 1;
            continue;
          }
          if (!KEYWORD.test(declared)) {
            if (first) stats.skippedNonKeyword += 1;
            continue;
          }
          const value = computed.getPropertyValue(longhand).trim();
          if (value === '') {
            report(undecidable, {
              kind: 'no-computed-value',
              file: rule.file,
              line: rule.line,
              selector: rule.selectorText,
              property: longhand,
              declared,
              detail: 'this engine reports no computed value for the property, so the declaration cannot be checked',
              context: label,
            });
            continue;
          }
          if (!KEYWORD.test(value)) {
            /* NOT REPORTED, and this is the decision that keeps class B
               usable. A keyword that computes to something which is no longer
               a keyword has been RESOLVED, not rejected: `inline-size:
               max-content` computes to a used pixel length on a rendered box,
               `background-color: transparent` computes to an rgb() triple, an
               `em` becomes a `px`. Those are spec-mandated resolutions of a
               value that was accepted — class A has already established that
               the keyword is legal for the property — and reporting them would
               bury the one row that matters under normalisation noise. A guard
               that reports every normalisation gets muted, and a muted guard
               is worth less than no guard. */
            if (first) stats.skippedResolved += 1;
            continue;
          }
          if (first) stats.keywordsCompared += 1;
          stats.comparisons += 1;
          if (value.toLowerCase() === declared.toLowerCase()) continue;
          report(findings, {
            kind: 'coerced-to-another-keyword',
            class: 'B',
            file: rule.file,
            line: (rule.declarations.find((d) => {
              scratch.style.cssText = `${d.property}: ${d.value}`;
              return scratch.style.getPropertyValue(longhand).trim().toLowerCase() === declared.toLowerCase();
            }) ?? rule).line,
            selector: rule.selectorText,
            property: longhand,
            declared,
            detail: `declares \`${declared}\` and computes to \`${value}\` with this rule's own block applied`,
            context: label,
          });
        }
        probe.style.cssText = '';
      }
    }
  }

  /* ── The guard on the guard, part one: does the engine still behave the way
     the two recorded defects say it does? Both probes are built from the
     table's own resolved unit rather than from a literal, so this file holds
     no value of its own. If a future Chromium fixes either, these go loud and
     the corresponding class is re-argued instead of quietly weakening. */
  host.setAttribute('data-density', 'comfortable');
  host.setAttribute('data-input', 'pointer');
  host.setAttribute('data-theme', 'light');
  const unit = getComputedStyle(probe).getPropertyValue('--unit').trim();
  const bites = {
    unit,
    rejectsLoneCalc: unit !== '' && !CSS.supports('overflow-clip-margin', `calc(${unit} / 2)`),
    acceptsKeyworded: unit !== '' && CSS.supports('overflow-clip-margin', `padding-box calc(${unit} / 2)`),
    coerces: (() => {
      probe.style.cssText = 'overflow-x: auto; overflow-y: clip;';
      const value = getComputedStyle(probe).overflowY;
      probe.style.cssText = '';
      return value;
    })(),
    quietWhenBothScroll: (() => {
      probe.style.cssText = 'overflow-x: auto; overflow-y: auto;';
      const value = getComputedStyle(probe).overflowY;
      probe.style.cssText = '';
      return value;
    })(),
  };

  /* ── The guard on the guard, part two: does the source parser above agree
     with the browser's own parser? The CSSOM has no line numbers, which is why
     the parser exists; if it drifts, every count this run prints becomes
     fiction. A disabled <style> is used so the sheet is parsed but never
     applied to the page the app is rendering. */
  const parserAudit = [];
  for (const file of files) {
    const style = document.createElement('style');
    style.disabled = true;
    style.textContent = file.source;
    document.head.append(style);
    style.disabled = true;
    const flat = [];
    /* A CSSStyleRule owns a (usually empty) `cssRules` list of its own since
       CSS nesting landed, so "has children, therefore is a group" is wrong and
       was measured wrong: the first run of this cross-check reported zero rules
       in every file and called the parser broken. Record the selector first,
       then descend regardless. */
    const walk = (list) => {
      for (const rule of list) {
        if (typeof rule.selectorText === 'string') flat.push(rule.selectorText);
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    if (style.sheet) walk(style.sheet.cssRules);
    style.remove();
    const normalise = (text) =>
      text
        .replace(/'/g, '"')
        .replace(/\s+/g, ' ')
        .replace(/\s*([>+~,()])\s*/g, '$1')
        .toLowerCase()
        .trim();
    const mine = file.rules.map((rule) => normalise(rule.selectorText));
    const theirs = flat.map(normalise);
    const mismatch = mine.length !== theirs.length || mine.some((text, index) => text !== theirs[index]);
    parserAudit.push({
      file: file.file,
      mine: mine.length,
      theirs: theirs.length,
      mismatch,
      first: mismatch ? (mine.find((text, index) => text !== theirs[index]) ?? mine.at(-1) ?? '') : '',
    });
  }

  host.remove();
  return { findings, undecidable, stats, bites, parserAudit };
}

/* ══════════════════════════════════════════════════════════════════════════
   Class C — reach, in the page
   ══════════════════════════════════════════════════════════════════════════ */

function reachInPage(input) {
  /* Interaction pseudo-classes are stripped before matching. The question this
     class asks is whether the ELEMENT a rule addresses exists, not whether the
     mouse happens to be over it — leaving `:hover` in would report every
     interactive rule in the table as unmatched, which is noise with a hundred
     percent false-positive rate. */
  const STATEFUL = /:(?:focus-visible|focus-within|focus|hover|active|target|visited|link)/g;
  const structural = (selector) => selector.replace(STATEFUL, '');
  const counts = {};
  for (const selector of input.selectors) {
    let total = 0;
    try {
      total = document.querySelectorAll(structural(selector)).length;
    } catch {
      total = -1;
    }
    counts[selector] = total;
  }
  return counts;
}

function termsInPage(input) {
  const STATEFUL = /:(?:focus-visible|focus-within|focus|hover|active|target|visited|link)/g;
  const counts = {};
  for (const term of input.terms) {
    let total = 0;
    try {
      total = document.querySelectorAll(term.replace(STATEFUL, '')).length;
    } catch {
      total = -1;
    }
    counts[term] = total;
  }
  return counts;
}

/**
 * A negation is not a claim that the thing exists — it is a claim about
 * elements that lack it, so `:not([data-clip='trim'])` matching nothing means
 * the negation matches EVERYTHING. Measured on the first run: the derived
 * scroll-region selector was reported with `[data-clip='trim']` as its dead
 * term, which reads as the exact inverse of the truth. Negated contents are
 * dropped before the inner attribute terms are extracted; the compound term
 * itself, negation included, is still tested as written.
 */
function withoutNegations(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(':not(', i)) {
      let depth = 0;
      let j = i + 4;
      for (; j < text.length; j++) {
        if (text[j] === '(') depth += 1;
        else if (text[j] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      i = j + 1;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

/**
 * A selector splits into terms at its combinators, and each attribute selector
 * inside a term is a term of its own. This is what separates the two things an
 * unmatched selector can mean: a term that matches nothing ANYWHERE is the
 * N700 shape (a vocabulary word nothing writes), while a selector whose every
 * term matches somewhere is a combination the demo never produced.
 */
function termsOf(selector) {
  const terms = new Set();
  let depth = 0;
  let current = '';
  const flush = () => {
    const text = current.trim();
    current = '';
    if (!text || text === '>' || text === '+' || text === '~' || text === '*') return;
    terms.add(text);
    for (const match of withoutNegations(text).matchAll(/\[[^\]]+\]/g)) terms.add(match[0]);
  };
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      flush();
      continue;
    }
    current += ch;
  }
  flush();
  return [...terms];
}

/* ══════════════════════════════════════════════════════════════════════════
   Harness
   ══════════════════════════════════════════════════════════════════════════ */

async function readTheme() {
  const dir = path.join(ROOT, THEME);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.css')).sort();
  const files = [];
  for (const name of names) {
    const source = await readFile(path.join(dir, name), 'utf8');
    files.push({ file: `${THEME}/${name}`, source, rules: parseSheet(`${THEME}/${name}`, source) });
  }
  // `index.css` is the manifest: if a layer stops being scanned, this is what
  // says so instead of the run quietly getting shorter. `states.css` is the one
  // that matters most — it is imported unlayered and beats everything.
  const index = files.find((file) => file.file.endsWith('index.css'));
  const imports = index ? [...index.source.matchAll(/@import\s+'\.\/([^']+)'/g)].map((m) => m[1]) : [];
  const missing = imports.filter((name) => !names.includes(name));
  return { files, imports, missing };
}

const LOST_CONTEXT = /Execution context was destroyed|frame was detached|Cannot find context|Target closed/i;

/**
 * The dev server reloads the page whenever anything under `src/` is saved, and
 * a reload lands mid-measurement as a destroyed execution context. That is the
 * tool losing its grip on the page, not a defect in the table — the first
 * self-test run of this file died on exactly that while a sibling agent saved
 * a page. Re-attach and take the measurement again; the recovery count is
 * printed so a suspiciously quiet run cannot hide behind one.
 *
 * Same shape as `geometry-proof.mjs`'s wrapper, and deliberately a copy rather
 * than a shared import: these two scripts are each meant to be runnable and
 * readable on their own.
 */
async function session(options) {
  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const state = { reloads: 0 };
  const attach = async () => {
    await page.waitForFunction(() => typeof window.__c11?.settled === 'function', undefined, { timeout: 15_000 });
    await page.evaluate(() => window.__c11.settled());
  };
  const run = async (action) => {
    try {
      return await action();
    } catch (error) {
      if (!LOST_CONTEXT.test(String(error))) throw error;
      state.reloads += 1;
      await attach();
      return await action();
    }
  };
  await page.goto(options.url, { waitUntil: 'load' });
  await run(attach);
  return {
    page,
    state,
    close: () => browser.close(),
    evaluate: (fn, arg) => run(() => page.evaluate(fn, arg)),
  };
}

function tokenContexts() {
  const contexts = [];
  for (const density of DENSITIES) {
    for (const input of INPUTS) {
      for (const theme of THEMES) contexts.push({ density, input, theme });
    }
  }
  return contexts;
}

/** The model handed to the page: source text plus the parsed rules. */
function modelOf(files) {
  return files.map((file) => ({ file: file.file, source: file.source, rules: file.rules }));
}

async function collectReach(browser, files, visiting) {
  const selectors = [];
  const owners = new Map();
  for (const file of files) {
    for (const rule of file.rules) {
      for (const selector of rule.selectors) {
        if (!owners.has(selector)) {
          owners.set(selector, { file: rule.file, line: rule.line });
          selectors.push(selector);
        }
      }
    }
  }
  const best = new Map(selectors.map((selector) => [selector, 0]));
  let visited = 0;
  for (const context of visiting) {
    await browser.evaluate(async (ctx) => {
      window.__c11.setContext(ctx);
      await window.__c11.settled();
    }, context);
    visited += 1;
    // One overflow menu is opened per context, so `[data-shown]` on the panel
    // is exercised rather than reported dead. Best effort: if no trigger is
    // shown at this width there is nothing to open, which is not a failure.
    await browser.evaluate(async () => {
      const trigger = document.querySelector('[data-overflow][data-shown]');
      if (trigger instanceof HTMLElement) {
        trigger.click();
        await window.__c11.settled();
      }
    });
    const counts = await browser.evaluate(reachInPage, { selectors });
    for (const [selector, total] of Object.entries(counts)) {
      best.set(selector, Math.max(best.get(selector) ?? 0, total));
    }
    await browser.evaluate(() => {
      const trigger = document.querySelector('[data-overflow][data-shown]');
      if (trigger instanceof HTMLElement && trigger.getAttribute('aria-expanded') === 'true') trigger.click();
    });
  }

  const unmatched = selectors.filter((selector) => (best.get(selector) ?? 0) <= 0);
  const terms = [...new Set(unmatched.flatMap(termsOf))];
  const termCounts = new Map(terms.map((term) => [term, 0]));
  if (terms.length > 0) {
    for (const context of visiting) {
      await browser.evaluate(async (ctx) => {
        window.__c11.setContext(ctx);
        await window.__c11.settled();
      }, context);
      const counts = await browser.evaluate(termsInPage, { terms });
      for (const [term, total] of Object.entries(counts)) {
        termCounts.set(term, Math.max(termCounts.get(term) ?? 0, total));
      }
    }
  }

  return {
    visited,
    checked: selectors.length,
    matched: selectors.length - unmatched.length,
    warnings: unmatched.map((selector) => {
      const dead = termsOf(selector).filter((term) => (termCounts.get(term) ?? 0) <= 0);
      return { selector, ...owners.get(selector), dead };
    }),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Output
   ══════════════════════════════════════════════════════════════════════════ */

function printFindings(title, entries, total) {
  console.log(`${title} (${entries.length})\n${'─'.repeat(title.length + 4)}`);
  let current = '';
  for (const entry of entries) {
    if (entry.file !== current) {
      current = entry.file;
      console.log(`\n${current}`);
    }
    console.log(`  ${entry.file}:${entry.line}  ${entry.selector}`);
    console.log(`      ${entry.property}: ${entry.declared}`);
    console.log(`      ${entry.detail}`);
    console.log(
      entry.contexts.length >= total
        ? `      in every one of ${total} token contexts`
        : `      in ${entry.contexts.length} of ${total} token contexts: ${entry.contexts.join(', ')}`,
    );
  }
  console.log('');
}

function selfChecksOf(audit, theme, pages) {
  const drift = audit.parserAudit.filter((entry) => entry.mismatch);
  return [
    {
      name: 'theme reachable',
      ok: theme.files.length > 0 && audit.stats.rules > 0,
      detail: `${theme.files.length} files, ${audit.stats.rules} rules, ${audit.stats.declarations} declarations`,
    },
    {
      name: 'every import scanned',
      ok: theme.missing.length === 0 && theme.imports.length > 0,
      detail:
        theme.missing.length === 0
          ? `${theme.imports.length} @import targets in index.css, all present`
          : `not scanned: ${theme.missing.join(', ')}`,
    },
    {
      name: 'parser agrees with the browser',
      ok: drift.length === 0,
      detail:
        drift.length === 0
          ? audit.parserAudit.map((entry) => `${path.basename(entry.file)} ${entry.mine}`).join(', ') +
            ' rules, same order, same selectors'
          : drift.map((entry) => `${entry.file}: ${entry.mine} parsed vs ${entry.theirs} in the CSSOM`).join('; '),
    },
    {
      name: 'class A still bites',
      ok: audit.bites.rejectsLoneCalc && audit.bites.acceptsKeyworded,
      detail: audit.bites.rejectsLoneCalc
        ? `overflow-clip-margin still rejects a lone calc() over the resolved unit and accepts the keyworded spelling: ${audit.bites.acceptsKeyworded}`
        : 'this engine now accepts a lone calc() for overflow-clip-margin — the recorded defect is gone and this class needs re-arguing',
    },
    {
      name: 'class B still bites',
      ok: audit.bites.coerces === 'hidden' && audit.bites.quietWhenBothScroll === 'auto',
      detail: `overflow-y: clip beside a scrollable inline axis computes to \`${audit.bites.coerces}\`; both-auto computes to \`${audit.bites.quietWhenBothScroll}\``,
    },
    {
      name: 'every harness page visited',
      ok: pages.length > 0,
      detail:
        pages.length > 0
          ? `${pages.length} read from ${PAGE_SOURCE}: ${pages.join(', ')}`
          : `PAGE_IDS could not be read from ${PAGE_SOURCE}, so class C visited nothing and its warnings mean nothing`,
    },
    {
      name: 'guard is not vacuous',
      ok:
        audit.stats.declarations > 100 &&
        audit.stats.uniquePairs > 50 &&
        audit.stats.substituted > 10 &&
        audit.stats.keywordsCompared > 20,
      detail: `${audit.stats.declarations} declarations parsed, ${audit.stats.uniquePairs} distinct property/value pairs answered by CSS.supports(), ${audit.stats.substituted} needed custom-property substitution, ${audit.stats.keywordsCompared} keyword longhands compared against their computed value`,
    },
  ];
}

/**
 * `override` exists for one reason: so the self-test can drive this exact
 * pipeline — findings, self-checks, verdict and EXIT CODE — over a table with
 * the recorded defects put back. A guard that finds a defect and returns zero
 * is not a guard, and that last link is not provable from the audit alone.
 */
async function run(options, override) {
  const theme = await readTheme();
  const pages = await readPages();
  const visiting = reachContexts(pages);
  const contexts = tokenContexts();
  const model = override?.model ?? modelOf(theme.files);
  const say = override?.silent ? () => {} : console.log;
  const live = await session(options);
  let audit;
  let reach;
  try {
    audit = await live.evaluate(auditInPage, { files: model, contexts });
    reach = await collectReach(live, model, visiting);
  } finally {
    await live.close();
  }

  const checks = selfChecksOf(audit, theme, pages);

  say(`c11 declaration guard — ${THEME} against ${options.url}\n`);
  say(`checked  ${audit.stats.declarations} declarations in ${audit.stats.rules} rules across ${model.length} files`);
  say(
    `         A  ${audit.stats.declarations - audit.stats.customProperties} declarations x ${contexts.length} token contexts -> ${audit.stats.supportsAnswers} CSS.supports() answers over ${audit.stats.uniquePairs} distinct pairs`,
  );
  say(
    `            ${audit.stats.substituted} carried a custom property and were tested as the value they substitute to; ${audit.stats.customProperties} custom-property declarations are checked at their consumers instead`,
  );
  say(
    `         B  ${audit.stats.keywordsCompared} keyword longhands x ${contexts.length} token contexts -> ${audit.stats.comparisons} computed comparisons, over ${audit.stats.blocksApplied} declaration blocks applied to the probe`,
  );
  say(
    `            not compared: ${audit.stats.skippedNonKeyword} non-keyword values, ${audit.stats.skippedResolved} keywords that resolve to a used value, ${audit.stats.skippedPending} longhands of a var() shorthand, ${audit.stats.skippedCssWide} css-wide keywords`,
  );
  say(
    `         C  ${reach.checked} selectors across ${reach.visited} page contexts; ${reach.matched} matched, ${reach.warnings.length} unmatched`,
  );
  say('');
  for (const check of checks) say(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}: ${check.detail}`);
  say('');

  if (!override?.silent) {
    if (audit.findings.length > 0) printFindings('findings', audit.findings, contexts.length);
    if (audit.undecidable.length > 0)
      printFindings('undecidable — measured nothing, so it says so', audit.undecidable, contexts.length);
  }

  if (reach.warnings.length > 0) {
    /* CLASS C IS A WARNING AND CANNOT HONESTLY BE MORE. "Dead" and "not
       exercised by the demo pages" are not distinguishable from four pages,
       and this table contains the proof: `[data-fit='unsatisfiable']` matches
       nothing here precisely BECAUSE the solver never gives up, so the rule is
       both correct and unmatched. A source-side producer scan does not rescue
       it either — `data-nisli-error` is written only by `@nisli/core`, outside
       this experiment, so a scan scoped to `src/` would have called a live
       rule dead. What IS decidable is printed instead: whether each term of an
       unmatched selector matches anything anywhere. A dead TERM is the N700
       shape — a vocabulary word nothing writes; all-terms-live means the
       combination is simply not on these four pages. */
    say(`unmatched selectors (${reach.warnings.length}) — warnings, never failures\n──────────────────`);
    for (const warning of reach.warnings) {
      say(`  ${warning.file}:${warning.line}  ${warning.selector}`);
      say(
        warning.dead.length > 0
          ? `      dead term(s) — nothing in any exercised context matches ${warning.dead.join(' or ')}`
          : '      every term matches somewhere; this combination is not on the demo pages',
      );
    }
    say('');
  }

  const broken = checks.filter((check) => !check.ok).length;
  const pass = audit.findings.length === 0 && broken === 0;
  say(
    (pass
      ? `PASS — every one of ${audit.stats.declarations} declarations in ${THEME} parses, substitutes and computes to what it says. ${audit.undecidable.length} undecidable, ${reach.warnings.length} unmatched selectors (warnings).`
      : `FAIL — ${audit.findings.length} declarations do not take effect, ${broken} broken self-checks.`) +
      (live.state.reloads > 0 ? ` (${live.state.reloads} dev-server reloads recovered from)` : ''),
  );
  return { code: pass ? 0 : 1, findings: audit.findings.length };
}

/* ══════════════════════════════════════════════════════════════════════════
   The self-test — the guard on the guard
   ══════════════════════════════════════════════════════════════════════════
   Every fixture is a PAIR: the spelling that was wrong and the spelling that
   is right, in a synthetic model that never touches `src/`. A row passes only
   if the guard reports the broken one AND stays silent on the fixed one —
   detection without silence is a guard nobody will keep.

   The first two fixtures are the two defects measured today, verbatim. The
   third is the same family with no `var()` at all, because a rejection that
   needs substitution and a rejection the parser makes outright are different
   code paths in class A.

   No fixture contains a length or a colour literal: every value is derived
   from the table's own `--unit`, which is the same discipline the table is
   held to.
   ══════════════════════════════════════════════════════════════════════════ */

const FIXTURES = [
  {
    name: 'A rejected',
    class: 'A',
    what: 'a lone calc() over the unit, which Chromium rejects after substitution',
    broken: { property: 'overflow-clip-margin', value: 'calc(var(--unit) / 2)' },
    fixed: { property: 'overflow-clip-margin', value: 'padding-box calc(var(--unit) / 2)' },
  },
  {
    name: 'A unknown',
    class: 'A',
    what: 'a property this engine does not have',
    broken: { property: 'overflow-clip-margins', value: 'var(--unit)' },
    fixed: { property: 'overflow-clip-margin', value: 'padding-box var(--unit)' },
  },
  {
    name: 'B coerced',
    class: 'B',
    what: 'overflow-y: clip beside a scrollable inline axis, which computes to hidden',
    prefix: { property: 'overflow-x', value: 'auto' },
    broken: { property: 'overflow-y', value: 'clip' },
    fixed: { property: 'overflow-y', value: 'auto' },
  },
];

const REACH_FIXTURE = {
  name: 'C unmatched',
  what: 'a selector naming a role the vocabulary does not have',
  broken: "[data-appearance='dropdown']",
  fixed: "[data-appearance='action']",
};

function fixtureModel(fixture, which) {
  const declarations = [];
  if (fixture.prefix) declarations.push({ line: 1, ...fixture.prefix, important: false });
  declarations.push({ line: 2, ...fixture[which], important: false });
  const selector = '[data-declaration-guard-fixture]';
  return [
    {
      file: `fixture/${fixture.name}.${which}.css`,
      source: `${selector} { ${declarations.map((d) => `${d.property}: ${d.value};`).join(' ')} }`,
      rules: [
        {
          file: `fixture/${fixture.name}.${which}.css`,
          line: 1,
          selectorText: selector,
          selectors: [selector],
          conditions: [],
          declarations,
        },
      ],
    },
  ];
}

/**
 * The two rows above prove the CLASSES can fail. These two prove the guard
 * would have caught the actual defects, at the actual call sites, in the real
 * table — which is a different claim, and the one that matters: a synthetic
 * two-line rule shares no cascade, no neighbouring declarations and no
 * selector with the table it stands in for.
 *
 * The real parsed model is deep-copied and one declaration in it is rewritten
 * back to the spelling that was wrong. Nothing under `src/` is touched, and a
 * rewrite that finds nothing to rewrite is INCONCLUSIVE rather than quietly
 * proving nothing — if the table moves, this says so.
 */
const REGRESSIONS = [
  {
    name: 'A in situ',
    class: 'A',
    what: "structure.css's clip margin with the keyword that rescues its parse removed",
    property: 'overflow-clip-margin',
    rewrite: (value) => value.replace(/^padding-box\s+/, ''),
  },
  {
    name: 'B in situ',
    class: 'B',
    what: "the derived scroll region's block axis back at clip beside a scrollable inline axis",
    property: 'overflow-y',
    rewrite: (value) => (value === 'auto' ? 'clip' : value),
  },
];

function regressionModel(regression, files) {
  const model = structuredClone(modelOf(files));
  const touched = [];
  for (const file of model) {
    for (const rule of file.rules) {
      for (const declaration of rule.declarations) {
        if (declaration.property !== regression.property) continue;
        const rewritten = regression.rewrite(declaration.value);
        if (rewritten === declaration.value) continue;
        touched.push(`${file.file}:${declaration.line}  ${declaration.property}: ${declaration.value} -> ${rewritten}`);
        declaration.value = rewritten;
      }
    }
  }
  return { model, touched };
}

async function runSelfTest(options) {
  const contexts = [{ density: 'comfortable', input: 'pointer', theme: 'light' }];
  const live = await session(options);
  const rows = [];
  let broken = 0;

  console.log(`c11 declaration guard — self-test against ${options.url}\n`);

  try {
    for (const fixture of FIXTURES) {
      const dirty = await live.evaluate(auditInPage, { files: fixtureModel(fixture, 'broken'), contexts });
      const clean = await live.evaluate(auditInPage, { files: fixtureModel(fixture, 'fixed'), contexts });
      const caught = dirty.findings.filter((finding) => finding.class === fixture.class);
      const noise = clean.findings.filter((finding) => finding.class === fixture.class);
      if (caught.length === 0) {
        rows.push({ name: fixture.name, verdict: 'BLIND', note: `${fixture.what} — the guard did not notice` });
        broken += 1;
        continue;
      }
      if (noise.length > 0) {
        rows.push({
          name: fixture.name,
          verdict: 'NOISY',
          note: `also reports the corrected spelling: ${noise[0].detail}`,
        });
        broken += 1;
        continue;
      }
      rows.push({
        name: fixture.name,
        verdict: 'CAUGHT',
        note: `${caught[0].property}: ${caught[0].declared} ${caught[0].detail}; the fixed spelling is silent`,
      });
    }

    const theme = await readTheme();
    const asShipped = await live.evaluate(auditInPage, { files: modelOf(theme.files), contexts });
    for (const regression of REGRESSIONS) {
      const { model, touched } = regressionModel(regression, theme.files);
      if (touched.length === 0) {
        rows.push({
          name: regression.name,
          verdict: 'INCONCLUSIVE',
          note: `no ${regression.property} declaration in the table to break — the fixture no longer describes it`,
        });
        broken += 1;
        continue;
      }
      const dirty = await live.evaluate(auditInPage, { files: model, contexts });
      const caught = dirty.findings.filter((finding) => finding.class === regression.class);
      const before = asShipped.findings.filter((finding) => finding.class === regression.class);
      if (caught.length === 0) {
        rows.push({
          name: regression.name,
          verdict: 'BLIND',
          note: `${regression.what} — the guard did not notice (${touched[0]})`,
        });
        broken += 1;
        continue;
      }
      if (before.length > 0) {
        // If the shipped table is already loud on this class, the row cannot
        // tell "the guard caught my defect" from "the table was already broken".
        rows.push({
          name: regression.name,
          verdict: 'INCONCLUSIVE',
          note: `the table as shipped already reports ${before.length} class ${regression.class} finding(s)`,
        });
        broken += 1;
        continue;
      }
      rows.push({
        name: regression.name,
        verdict: 'CAUGHT',
        note: `${touched[0]} -> ${caught[0].file}:${caught[0].line} ${caught[0].property} ${caught[0].detail}; silent as shipped`,
      });
    }

    // Class C runs against the live pages, because "matches nothing" is a
    // question about the DOM and cannot be asked of a synthetic model.
    const counts = await live.evaluate(reachInPage, {
      selectors: [REACH_FIXTURE.broken, REACH_FIXTURE.fixed],
    });
    const dead = counts[REACH_FIXTURE.broken];
    const matched = counts[REACH_FIXTURE.fixed];
    if (dead !== 0) {
      rows.push({
        name: REACH_FIXTURE.name,
        verdict: 'BLIND',
        note: `${REACH_FIXTURE.broken} matched ${dead} elements, so the fixture is not a fixture`,
      });
      broken += 1;
    } else if (matched <= 0) {
      rows.push({
        name: REACH_FIXTURE.name,
        verdict: 'INCONCLUSIVE',
        note: `${REACH_FIXTURE.fixed} matched nothing either, so a zero count proves nothing here`,
      });
      broken += 1;
    } else {
      rows.push({
        name: REACH_FIXTURE.name,
        verdict: 'CAUGHT',
        note: `${REACH_FIXTURE.what} matches 0 while ${REACH_FIXTURE.fixed} matches ${matched}; reported as a warning by design`,
      });
    }
  } finally {
    await live.close();
  }

  /* The last link, and it is not provable from the audit: the whole pipeline
     has to RETURN non-zero. Both recorded defects are put back at once and the
     real reporting path is driven end to end, output suppressed so the row
     stays a row. `verify` and CI read the exit code and nothing else, so a
     guard that reports a defect and exits zero is decoration with extra
     steps. */
  const theme = await readTheme();
  let regressed = modelOf(theme.files);
  let rewrites = 0;
  for (const regression of REGRESSIONS) {
    const applied = regressionModel(regression, regressed);
    regressed = applied.model;
    rewrites += applied.touched.length;
  }
  const verdict = await run(options, { model: regressed, silent: true });
  if (rewrites === 0 || verdict.code === 0) {
    rows.push({
      name: 'exit code',
      verdict: 'BLIND',
      note:
        rewrites === 0
          ? 'nothing to rewrite, so the failure path was never entered'
          : `${verdict.findings} finding(s) reported and the run still returned ${verdict.code}`,
    });
    broken += 1;
  } else {
    rows.push({
      name: 'exit code',
      verdict: 'CAUGHT',
      note: `the table with both recorded defects back reports ${verdict.findings} finding(s) and returns ${verdict.code}`,
    });
  }

  const widths = [14, 14, 108];
  const printRow = (cells) =>
    console.log(cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join('').trimEnd());
  printRow(['fixture', 'verdict', 'evidence']);
  printRow(['───────', '───────', '────────']);
  for (const row of rows) printRow([row.name, row.verdict, row.note]);
  console.log('');
  console.log(
    (broken === 0
      ? `PASS — all ${rows.length} defect classes fail when they should and are silent when they should not. This guard is a guard, not decoration.`
      : `FAIL — ${broken}/${rows.length} defect classes could not be shown to fail.`) +
      (live.state.reloads > 0 ? ` (${live.state.reloads} dev-server reloads recovered from)` : ''),
  );
  return broken === 0 ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════ */

const options = parseArgs(process.argv.slice(2));
process.exitCode = options.selfTest ? await runSelfTest(options) : (await run(options)).code;
