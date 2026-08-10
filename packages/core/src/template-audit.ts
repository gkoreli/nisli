/**
 * template-audit.ts — First-parse static template audit (ADR 0030.2 T4).
 *
 * Attached to the parse-once cache in template.ts: runs ONCE per `html`
 * callsite (keyed by TemplateStringsArray identity) at the first parse, and
 * walks the parsed-but-never-mounted template element checking its STATIC
 * parts. The silent-static-typo class — the no-build equivalent of a compile
 * error — dies in the engine, amortized free.
 *
 * Checks (per ADR 0030.2 §2 T4 as amended by §8 "T4 (template)"):
 * - N101 — a dash-tag with no customElements definition. Races
 *   `customElements.whenDefined` against a microtask + macrotask grace so
 *   ordinary lazy definition (module import order) never warns.
 * - N102 — an `@event` name that is neither a known native event nor an
 *   allowlisted component-dispatched event (`ui-*`, `nisli-*`).
 * - N103 — an unknown `@event.modifier`.
 * - N104 — an attribute on a component tag that declares attributes
 *   (non-empty `static observedAttributes`) which is neither declared nor a
 *   global HTML attribute. Components WITHOUT declared attributes get NO
 *   attribute audit: pre-schema (T3) there is no truth source — auto-resolved
 *   props are deliberately not attributes (§8).
 *
 * Suppression escape (designed for lazy islands, §8): a comment directive as
 * the template's FIRST node (leading whitespace allowed):
 *
 *   html`<!-- nisli-audit off --><my-island>…</my-island>`
 *     — disables the whole audit for this template.
 *
 *   html`<!-- nisli-audit allow-undefined: my-island other-tag --><…>`
 *     — suppresses only N101 for the named tags (other checks stay live).
 *
 * The directive comment is static content: it survives into the mounted DOM
 * (and SSG output) as an inert HTML comment. Documented, accepted for the
 * prototype; the design gate may choose to strip it at parse.
 *
 * Dev gating: core has no build-time dev/prod define today — that mechanism
 * is a named Wave-1 deliverable (§8). Until it exists this module is gated on
 * the `devMode` flag below ONLY. SSG/happy-dom detection is deliberately NOT
 * attempted (unreliable); an SSG build that wants silence must call
 * `setTemplateAuditEnabled(false)` before rendering.
 */

// Reporting goes through the diagnostics leaf. The audit keeps its own
// enable override (tests, SSG environments) and otherwise follows the
// leaf's dev gate — under NODE_ENV=production builds it is silent.
import { diag as emitDiag, isDev } from './diagnostics.js';

let enabledOverride: boolean | null = null;

/**
 * Enable/disable the first-parse audit (and its callsite capture);
 * `null` restores the dev-gate default.
 */
export function setTemplateAuditEnabled(enabled: boolean | null): void {
  enabledOverride = enabled;
}

/** Current audit gate state (exposed for template.ts and tests). */
export function isTemplateAuditEnabled(): boolean {
  return enabledOverride ?? isDev();
}

/** Emit a coded audit diagnostic through the diagnostics leaf (audit-gated). */
export function diag(code: string, message: string, detail?: unknown): void {
  if (!isTemplateAuditEnabled()) return;
  emitDiag(code, message, detail === undefined ? undefined : { detail });
}

// ── Callsite capture ────────────────────────────────────────────────

/** First-seen authoring callsite per template identity (dev only). */
const callsites = new WeakMap<TemplateStringsArray, string>();

/**
 * Remember the authoring callsite of an `html` template the first time its
 * strings identity is seen. Must be called from `html()` itself — by the
 * time the first parse happens (first mount), the authoring frame is gone
 * from the stack. No-op when the audit is disabled or already captured.
 */
export function captureCallsite(strings: TemplateStringsArray): void {
  if (!isTemplateAuditEnabled() || callsites.has(strings)) return;
  const stack = new Error().stack ?? '';
  const frame = stack
    .split('\n')
    .slice(1)
    .find(line => line.includes('at ') && !/template(-audit)?\.(ts|js|mjs|cjs)/.test(line));
  callsites.set(strings, frame ? frame.trim() : '(unknown callsite)');
}

// ── Audit ───────────────────────────────────────────────────────────

const audited = new WeakSet<TemplateStringsArray>();

/** Modifiers understood by bindEvent (template.ts). */
const KNOWN_MODIFIERS = new Set(['stop', 'prevent', 'once', 'enter', 'escape', 'space', 'tab']);

/** Component-dispatched event prefixes exempt from the native-event check (§8). */
const COMPONENT_EVENT_PREFIXES = ['ui-', 'nisli-'];

/** Real native events with no `on*` IDL attribute (the `in`-check misses them). */
const NATIVE_EVENTS_WITHOUT_IDL = new Set(['focusin', 'focusout']);

/**
 * Global HTML attributes legal on ANY component tag. Mirrors (and must stay a
 * superset of) template.ts's auto-resolution exclusion list — these reach the
 * element as plain attributes, never `_setProp`.
 */
const GLOBAL_ATTRS = new Set([
  'id', 'class', 'style', 'slot', 'title', 'role', 'tabindex', 'name',
  'part', 'hidden', 'dir', 'lang', 'is',
]);

interface AuditDirectives {
  off: boolean;
  allowUndefined: Set<string>;
}

/** Parse the leading `<!-- nisli-audit … -->` directive comment, if any. */
function parseDirectives(content: DocumentFragment): AuditDirectives {
  const directives: AuditDirectives = { off: false, allowUndefined: new Set() };
  for (const node of content.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? '').trim() === '') continue; // leading whitespace
      break;
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      const body = (node.textContent ?? '').trim();
      if (!body.startsWith('nisli-audit')) break;
      const rest = body.slice('nisli-audit'.length).trim();
      if (rest === 'off') {
        directives.off = true;
      } else if (rest.startsWith('allow-undefined')) {
        const tags = rest
          .slice('allow-undefined'.length)
          .replace(/^[:\s]+/, '')
          .split(/[\s,]+/)
          .filter(Boolean);
        for (const tag of tags) directives.allowUndefined.add(tag.toLowerCase());
      }
    }
    break; // only the FIRST non-whitespace node may carry the directive
  }
  return directives;
}

/**
 * N101 — dash-tag with no definition. Rather than warning synchronously (the
 * defining module may simply import later in the same task), race
 * `customElements.whenDefined(tag)` against a microtask + macrotask grace;
 * warn only if the tag is still undefined after the grace elapses.
 */
function checkDashTag(tag: string, site: string): void {
  let registry: CustomElementRegistry | undefined;
  try {
    registry = customElements;
  } catch {
    return; // no registry in this environment — nothing to check
  }
  if (!registry || registry.get(tag)) return;

  let defined = false;
  try {
    registry.whenDefined(tag).then(
      () => { defined = true; },
      () => { /* invalid name — the synchronous throw below already covers it */ },
    );
  } catch {
    diag('N101', `<${tag}> is not a valid custom element name — at ${site}`);
    return;
  }

  // Grace: one microtask hop (whenDefined settlements for definitions made
  // earlier in this task) + one macrotask hop (definitions made later in the
  // same task, e.g. module evaluation order). Under fake timers the macrotask
  // may never fire — the warning is simply skipped, never wrong.
  queueMicrotask(() => {
    if (defined) return;
    setTimeout(() => {
      try {
        if (!isTemplateAuditEnabled() || defined || registry!.get(tag)) return;
        diag(
          'N101',
          `<${tag}> is used in a template but never defined (customElements.get returned ` +
          `undefined after grace) — at ${site}. If this tag is a lazily-loaded island, ` +
          `suppress with a leading <!-- nisli-audit allow-undefined: ${tag} --> comment.`,
        );
      } catch { /* environment torn down during grace — nothing to report */ }
    }, 0);
  });
}

/** N102/N103 — event-name and modifier checks for one `@event.mods` attribute. */
function checkEvent(el: Element, attrName: string, site: string): void {
  const parts = attrName.slice(1).split('.');
  const eventName = parts[0] ?? '';
  const modifiers = parts.slice(1);

  const isNative = `on${eventName}` in el || NATIVE_EVENTS_WITHOUT_IDL.has(eventName);
  const isComponentEvent = COMPONENT_EVENT_PREFIXES.some(p => eventName.startsWith(p));
  if (eventName && !isNative && !isComponentEvent) {
    diag(
      'N102',
      `@${eventName} on <${el.tagName.toLowerCase()}> is not a known native event ` +
      `(and not an allowlisted ${COMPONENT_EVENT_PREFIXES.join('/')} component event) — at ${site}`,
    );
  }
  for (const mod of modifiers) {
    if (!KNOWN_MODIFIERS.has(mod)) {
      diag(
        'N103',
        `unknown event modifier ".${mod}" in "${attrName}" — known: ` +
        `${[...KNOWN_MODIFIERS].join(', ')} — at ${site}`,
      );
    }
  }
}

/** N104 — undeclared attribute on a component that DECLARES attributes. */
function checkComponentAttr(tag: string, name: string, observed: string[], site: string): void {
  if (name.startsWith('data-') || name.startsWith('aria-')) return;
  if (GLOBAL_ATTRS.has(name) || observed.includes(name)) return;
  diag(
    'N104',
    `<${tag}> declares attributes [${observed.join(', ')}] but the template sets ` +
    `unknown "${name}" — at ${site}. Undeclared names route through _setProp and are ` +
    `silently dead as attributes.`,
  );
}

/**
 * Run the one-time static audit over a freshly parsed template. Called by
 * template.ts's parse-once cache on cache miss; idempotent per template
 * identity, no-op when the audit is disabled. Read-only over the cached
 * template element — mounting state is never touched.
 */
export function auditTemplate(strings: TemplateStringsArray, template: HTMLTemplateElement): void {
  if (!isTemplateAuditEnabled() || audited.has(strings)) return;
  audited.add(strings);

  const site = callsites.get(strings) ?? '(unknown callsite)';
  const content = template.content;
  const directives = parseDirectives(content);
  if (directives.off) return;

  for (const el of content.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    const isDashTag = tag.includes('-');

    if (isDashTag && !directives.allowUndefined.has(tag)) {
      checkDashTag(tag, site);
    }

    // Attribute audit ONLY for components with declared attrs (§8): a
    // non-empty static observedAttributes is the single pre-T3 truth source.
    let observed: string[] | undefined;
    if (isDashTag) {
      const ctor = customElements.get(tag) as { observedAttributes?: unknown } | undefined;
      const list = ctor?.observedAttributes;
      if (Array.isArray(list) && list.length > 0) observed = list as string[];
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name;
      if (name.startsWith('@')) {
        checkEvent(el, name, site);
        continue;
      }
      // Directive positions with their own semantics — never attributes.
      if (name.startsWith('class:') || name === 'ref' || name === 'html:inner') continue;
      if (observed) checkComponentAttr(tag, name, observed, site);
    }
  }
}
