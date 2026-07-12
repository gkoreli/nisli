# WWW-10 — client-hydrated interactive previews (proposal)

**Status**: proposal — `eng3` → arch review before building.
**Why**: `/ui/<name>` pages ship a static SSG preview frame. For floating overlays
(dropdown, popover, combobox, drawer, tooltip, context-menu, menubar, hover-card)
the SSG-safe state is only the trigger — open/positioned content is client-only by
the same reasoning as the portal/SSG ruling (the floating lib anchors with JS; the
item parts require the live component context). This ticket adds the site's **first
client runtime** so a preview frame can *come alive* as real nisli. It also unlocks
the interactivity the mission always implied: open-dialog demos, working tabs, and
the theme-switcher-as-nisli class of demo.

Because it's the site's first client bundle, this is an architecture decision, so it
gets a proposal first.

## 1. Hydration boundary — the preview frame, nothing else

The boundary is the existing `data-preview="<name>"` div on each `/ui/<name>` page.
Nothing outside it hydrates. The rest of the site stays zero-JS static (the nav's
theme toggle + code copy remain the only inline scripts).

- **Server (unchanged)**: SSG renders the static preview into the frame — the current
  WWW-9 output. This is the no-JS baseline and never regresses.
- **Client**: a tiny per-page entry finds its `[data-preview]` frame, clears the
  static children, and mounts the **live** example (`getExample(name)()`), so the real
  nisli component runs — floating content anchors, dialogs open, tabs switch.

```html
<!-- emitted on /ui/dropdown-menu only -->
<script type="module" src="/ui-preview/dropdown-menu.js"></script>
```
```ts
// ui-preview/dropdown-menu.js  (generated per curated component)
import { html } from '@nisli/core';
import { getExample } from '../examples.js';
const frame = document.querySelector('[data-preview="dropdown-menu"]');
const example = getExample('dropdown-menu');
if (frame && example) { frame.replaceChildren(); html`${example()}`.mount(frame); }
```

## 2. Bundle scope — per-page, code-split (recommended)

Each `/ui/<name>` page loads **only its own** component + example, not all 45. One
client entry per curated component, code-split so `/ui/button` never ships `dialog`.

- Scope is **preview hydration only** in v1 — not a site-wide SPA runtime. (The
  AppRouter already routes; production stays static HTML per route. This ticket does
  not client-route production.)
- Rough cost: `@nisli/core` (~small, zero-dep) + one component module + its example,
  per page, lazily loaded. Only pages the user visits pay for it.
- Components with **no curated example** ship no preview script (their auto-default
  static render stands).

## 3. Build integration

The production build (`buildStaticSite` via vitest) emits static HTML today with no
client bundle. WWW-10 adds a **client build step** — the natural tool is Vite (already
a www devDep, already bundling the dev entry), invoked in `build` after the SSG render:

- Generate one entry per curated component (`ui-preview/<name>.ts`) — or a single
  entry with a `data-preview`-driven dynamic `import()` map (Vite code-splits it).
- `vite build` → hashed chunks under `dist/ui-preview/`; the SSG shell injects the
  matching `<script type="module">` onto each `/ui/<name>` page.
- Reuses the exact browser mount pattern dev already proves (`html\`${x}\`.mount`).

## 4. No-JS fallback = the current static frame

Progressive enhancement, strictly. With JS off/broken, the SSG static preview (WWW-9)
remains: inline components render fully; floating overlays show their trigger. The
client only *replaces* the frame's contents once its module loads and mounts — a
failed/blocked load leaves the static baseline untouched.

## 5. What it unlocks (beyond floating overlays)

- Open-state demos for dropdown/popover/dialog/sheet/combobox/drawer/tooltip.
- Working tabs / accordion / carousel interaction on the gallery.
- The theme-switcher-as-nisli + tab-based doc demos the mission described — the same
  hydration boundary generalizes to any `[data-hydrate]` island later.

## Open questions for arch
1. **Bundle strategy**: per-component entries vs. one dynamic-`import()` map? (Both
   code-split; the map is one script tag + fewer generated files.)
2. **Scope guard**: keep v1 to `/ui` preview hydration only, or also convert the
   nav theme toggle to a real nisli island in the same runtime?
3. **Interaction affordance**: auto-mount live on load, or gate behind a "▶ Run"
   toggle per preview (cheaper first paint, explicit opt-in to JS)?
4. **Which components hydrate first**: all curated, or start with the 8 floating
   overlays that most need it?
