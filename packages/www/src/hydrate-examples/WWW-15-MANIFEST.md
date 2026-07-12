# WWW-15 — interactive preview touch manifest

Authoritative audit (eng1, component-knowledge lane) of which `/ui/<name>` previews
respond to input, for cdx2's `preview-sweep.mjs` touch guard. Each JS-DRIVEN row lists
the synthetic input the guard performs and the observable before→after it asserts.
eng1 authors the hydrate-example files listed under "author"; eng3 owns the frame /
hydration predicate; cdx2 owns the guard (consumes this manifest; does not touch it).

Legend for **kind**:
- **hydrate** — JS-driven interactivity; static SSG shows a resting state, comes alive
  only after hydration. Gets a `hydrate-examples/<name>.ts` (eng1) + joins the hydrate
  set. The guard performs the touch and asserts the after-state.
- **native** — interactivity is the platform's (real `<input>` + CSS `:checked`/`:focus`);
  works in static HTML with NO hydration. The guard may click and assert the native
  property, but must NOT require a hydration chunk.
- **overlay-done** — already a hydrate-example (WWW-10 floating set); listed for
  completeness, not in WWW-15 scope.

## JS-driven — eng1 authors hydrate-examples/<name>.ts (WWW-15 scope)

| name | kind | synthetic input (click unless noted) | assert AFTER (before in parens) |
|------|------|--------------------------------------|----------------------------------|
| accordion | hydrate | first `[data-slot="accordion-trigger"]` | its item's `[data-slot="accordion-content"]` shows `data-state="open"` + `aria-expanded="true"` on the trigger (before: `data-state="closed"`, content hidden) |
| tabs | hydrate | a NON-active `[role="tab"]` (2nd trigger) | that tab `aria-selected="true"` / `data-state="active"` and its `[role="tabpanel"]` visible; the previously-active panel hidden (before: 2nd tab `aria-selected="false"`) |
| carousel | hydrate | `[data-slot="carousel-next"]` button | `[data-slot="carousel-content"]` viewport `scrollLeft > 0` (before: `scrollLeft === 0`) |
| calendar | hydrate | the FIRST enabled, not-yet-selected `[data-slot="calendar-day-button"]` | that button `aria-selected` flips `"false"` → `"true"` (in range mode the click starts a new range there). The example holds a LIVE `selected` signal updated from the bubbling `ui-select` event — a plain `selected` object would PIN the controlled selection and the tap would not be observable (rev reject fix); regression: `src/hydrate-example-calendar.test.ts` |
| collapsible | hydrate | `[data-slot="collapsible-trigger"]` | `[data-slot="collapsible-content"]` `data-state="open"` + visible (before: `data-state="closed"`, hidden) |
| toggle | hydrate | `[data-slot="toggle"]` (a NOT-pressed one — the 2nd/3rd) | `aria-pressed="true"` + `data-state="on"` (before: `aria-pressed="false"`) |
| toggle-group | hydrate | a NOT-selected `[data-slot="toggle-group-item"]` (Left/Right; Center is pre-selected) | that item `aria-pressed="true"` (before: `aria-pressed="false"`) |
| button-group | hydrate | a `<button>` inside `[data-slot="button-group"]` (e.g. "Copy") | a visible status node `[data-slot="button-group-status"]` textContent updates to the clicked action (before: initial "—"). NB: button-group has no native group state, so the example carries a tiny reactive status signal to be click-OBSERVABLE (per cdx1); registry cohesion (joined outline) is cdx1's registry-only fix, not exercised here |

**Count: 8 JS-driven hydrate examples (eng1 authors all 8).**

## native — no hydration needed (guard must NOT require a hydrate chunk)

| name | kind | note |
|------|------|------|
| **select** | native | **CORRECTION (was mislisted JS-driven): nisli `Select` renders a real `<select>` with `<option>` children — the native dropdown works with NO JS.** No `select-trigger`/`role=listbox`. Guard: assert it is a `<select>` with options / a `change` fires; do NOT require a hydrate chunk |
| **slider** | native | **CORRECTION: nisli `Slider` is a real `<input type="range">` — native drag + keyboard, no JS.** Guard: focus the `[data-slot="slider"]` range input + `ArrowRight` → `value`/`aria-valuenow` increases; no hydrate chunk |
| checkbox | native | real `<input type=checkbox>`; click flips `:checked` → CSS checkmark with no JS. `data-state` reflection is JS-only, but the visual works static. Guard may assert `input.checked` flips on click |
| switch | native | real `<input type=checkbox role=switch>`; native toggle + `peer-checked` CSS thumb slide, no JS |
| radio-group | native | real `<input type=radio>` set; native selection + `:checked` CSS |
| input / textarea | native | real controls; native typing/focus |
| input-otp | native | real inputs; native typing (the active/invalid rings are state CSS) |

## overlay-done — already hydrate-examples (WWW-10), not WWW-15 scope

dialog, alert-dialog, sheet, drawer, popover, tooltip, hover-card, dropdown-menu,
context-menu, menubar, navigation-menu, combobox, command (via combobox), toast,
scroll-area.

## Deferred / flag

- **resizable** — drag-to-resize is JS-driven but pointer-drag is not reliably
  synthesizable in the guard; keyboard resize (focus `[data-slot="resizable-handle"]`,
  Arrow keys → panel flex-basis change) is the assertable path. Author if cdx2's guard
  can drive keyboard on the handle; otherwise defer with a note (do not silently skip).
- **pagination** — links are navigational (`href`), not stateful in a demo; treat as
  native/no-touch unless a controlled active-page demo is wanted.
