# Priority- and attention-adaptive UI — what has actually shipped

**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: shipped systems where the UI reorganizes itself by *declared importance*, and the exact vocabularies those systems use to model attention.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — new package `@nisli/next`

> Every load-bearing claim carries a `owner/repo path:line` citation or a URL. Anything I
> could not verify from a primary source is marked `[UNVERIFIED]`.

---

## Verdict in five bullets

1. **`data-priority` is not novel, and that is the good news — it is *convergent*.** Five
   independently-designed systems, from three vendors, ship the same primitive: a declaration on
   a child saying "drop me first", resolved by a container that measures. Apple's
   `NSToolbarItem.VisibilityPriority` (4-level ordinal), Microsoft's WinUI
   `ICommandBarElement.DynamicOverflowOrder` (`int`, Windows App SDK 0.8 → **2.0**),
   Microsoft's web `@fluentui/priority-overflow` (**390,162 downloads/week**), the Windows
   Ribbon `ScalingPolicy` XML manifest (Windows 7, 2009), and KDE Kirigami's `DisplayHint`
   flags. Convergence across three vendors over ~17 years is the strongest positive signal in
   this slice. **Steal the vocabulary; do not re-derive it** — and note that exactly one of the
   five (Kirigami) refuses the ordinal and uses capability *flags* instead, which is the design
   most robust to independently-generated components (§13, §Ideas #5).
2. **But every shipped priority system is scoped to ONE widget — a toolbar / command bar — and
   none generalises to arbitrary layout.** The one system that *did* try to generalise, the
   Windows Ribbon, is the cautionary tale: it required a hand-authored per-tab degradation
   manifest, a *compile-time validation error* if the control list did not exactly match a
   template, and a documented advisory to hand-specify enough scaling detail to survive a
   300px-wide ribbon. **The closest existing thing to C11 is more authoring, not less.**
3. **The richest attention vocabularies are all in the NOTIFICATION domain, and they encode
   *interruption cost*, not *visual salience*.** Android's
   `IMPORTANCE_NONE|MIN|LOW|DEFAULT|HIGH|MAX` (0/1/2/3/4/5), iOS's
   `passive|active|timeSensitive|critical`, and ARIA's `off|polite|assertive` are ordinal
   scales whose semantics are *"how much of the user's current task am I allowed to destroy"*.
   None mentions size, position, or contrast. If `@nisli/next` wants an attention axis, this
   is its shape — and it is a **separate axis from `data-priority`**, which is a *survival
   ordering under space pressure*, not an interruption budget.
4. **The one standards-track "attention order" feature — CSS `reading-flow`/`reading-order` —
   explicitly disclaims visual effect.** Spec text: *"The `reading-flow` property affects
   neither layout nor painting order and therefore has no effect on rendering to the visual
   canvas."* It orders AT and sequential-navigation traversal, not human visual attention. Its
   *declaration shape* is exactly what we want (`reading-order: <integer>`, initial `0`,
   ordinal groups, ties broken by container policy). Its *semantics* are not. Do not oversell it.
5. **Attention and hierarchy are NOT machine-checkable the way our fit checker is — but a
   useful subset is.** Perceptual salience has no shipped build-time oracle: saliency models are
   trained on human eye-tracking and evaluated against *other humans'* fixations, so their
   ground truth is a distribution, not a verdict. What IS decidable is a small set of
   **order and cardinality invariants over declarations plus geometry**: "the element declared
   most important is not the one that got collapsed", "declared reading order agrees with
   rendered geometric order", "exactly one element per surface carries the top emphasis level",
   "an assertive live region exists at most once". Those are set/ordering predicates, not
   perceptual judgements. Ship those; name them honestly.

---

## Systems surveyed

| system | what it does | adoption (dl/wk · activity) | status | relevance |
|---|---|---|---|---|
| **`@fluentui/priority-overflow`** (microsoft/fluentui) | Framework-agnostic priority queue + `ResizeObserver`; hides lowest-priority items into an overflow menu; `pinned` = never hide; tri-valued group state | **390,162/wk**; `@fluentui/react-overflow` **377,315/wk**; `@fluentui/react-components` **394,167/wk** (npm point API, last-week, fetched 2026-08-25) | **live**, v9.4.3 | closest shipped analogue of our fit solver — its algorithm *and its fudge factors* are our best evidence |
| **AppKit `NSToolbarItem.VisibilityPriority`** | 4-level ordinal `low`/`standard`/`high`/`user`; overflow pushes `low` first; **ties break toward the trailing edge** | ships in every macOS app; docs current (© 2026) | **live** | documents the exact tie-break rule our round-5 proof got wrong |
| **WinUI `ICommandBarElement.DynamicOverflowOrder`** | `int` per command: order in which primary commands move to the overflow menu | Windows App SDK **0.8 → 2.0** | **live** | literally `data-priority` under another name |
| **Windows Ribbon `ScalingPolicy` / `SizeDefinition`** | Declarative XML: per-tab ordered `<Scale Group Size>` ladder over `Large → Medium → Small → Popup` + an `IdealSizes` block | shipped Windows 7 (2009); docs `ms.date: 2018-05-31` | **legacy, not deprecated** | the only shipped system declaring *multi-step degradation ladders* per group — and the cautionary tale |
| **`@primer/react` `ActionBar` / `UnderlineNav`** | Overflow with **no priority declaration at all**: a shared `IntersectionObserver` marks clipped items `data-overflowing`, and they re-render inside an `ActionMenu` | **57,345/wk**; v38.36.0 | **live** | the counter-example: GitHub's design system solves overflow *without* an importance vocabulary |
| **`@vaadin/menu-bar`** | Overflow with a *direction* declaration only: `reverseCollapse` boolean ("collapse into the overflow menu starting from the `start` end instead of the `end`"); no per-item priority | **70,017/wk**; v25.2.8 | **live** | third independent vendor confirming direction matters and priority is optional |
| **`@github/details-menu-element`** | `<details>` + `<details-menu role="menu">` — a *disclosure widget*, not an overflow system; no priority, no measurement | **63,639/wk**; v1.0.13 | **live** | included for completeness: it is progressive disclosure as a component, with zero adaptive behaviour |
| **KDE Kirigami `DisplayHint`** | Importance as **bit flags**, not an ordinal: `NoPreference=0`, `IconOnly=1`, `KeepVisible=2`, `AlwaysHide=4`, `HideChildIndicator=8`; `KeepVisible` and `AlwaysHide` are documented mutually exclusive with a stated precedence | ships in KDE Plasma; `src/layouts/displayhint.h`, helper `@since 2.14` | **live** | the only shipped system that models importance as *capability flags* rather than a scale — and it independently invented the "not stated" sentinel |
| **Android `NotificationManager.IMPORTANCE_*`** | 6 usable levels + 1 sentinel, integer-valued, each with a documented behavioural consequence | every Android device since API 24 (2016) | **live** | best-specified attention enumeration in existence |
| **`UNNotificationInterruptionLevel`** | `passive` / `active` / `timeSensitive` / `critical` | iOS 15+, macOS 12+, tvOS 15+, watchOS 8+, visionOS 1+ | **live** | 4-level scale defined purely by *what it may interrupt* |
| **ARIA `aria-live`** | `off` / `polite` / `assertive`; roles carry implicit values (`alert` ⇒ `assertive`, `log` ⇒ `polite`) | WAI-ARIA, normative; 1.3 ED 20 Aug 2026 | **live, normative** | the only *web-standard* attention enumeration |
| **CSS `reading-flow` + `reading-order`** | `normal \| source-order \| flex-visual \| flex-flow \| grid-rows \| grid-columns \| grid-order` + `reading-order: <integer>` per child | CSS Display L4 ED, 5 Jun 2026; WPT `css/css-display/reading-flow/tentative/*` | **standards-track** | the declaration *shape* we want; explicitly **not** visual |
| **SwiftUI `Prominence`** | `standard` / `increased` — a 2-level emphasis enum, applied via `.headerProminence(_:)` | iOS 15+, macOS 12+ | **live** | the smallest possible shipped emphasis scale, and it is *contextual*, not per-control |
| **Adobe Spectrum (`@spectrum-web-components/button`)** | Emphasis is **factored into two orthogonal axes**: `variant: accent \| primary \| secondary \| negative` × `treatment: fill \| outline`, plus `static-color: white \| black` | `@spectrum-web-components/action-bar` 14,880/wk; button pkg v1.12.2 | **live** (`quiet`, `cta`, `overBackground` all deprecated) | the only system that *separates semantic role from emphasis strength* |
| **Material 3 (`@material/web`)** | Five button "types" ordered by emphasis: elevated, filled, filled-tonal, outlined, text | **134,690/wk**; docs reviewed 2026-07-31 | **live** | emphasis expressed as *five named components*, not a scale — the anti-pattern for an agent vocabulary |
| **libadwaita `AdwBreakpoint`** | Declarative `<condition>max-width: 400px</condition>` + `<setter object property>value</setter>` — property assignments, applied and *automatically reverted* | GNOME 45+ (libadwaita 1.4, 2023) | **live** | the cleanest declarative "when small, become this" mechanism outside CSS — and it is still a breakpoint |
| **HTML `hidden="until-found"` / `content-visibility`** | Three-valued `visible \| auto \| hidden`; `until-found` keeps content findable by find-in-page and fragment nav, fires `beforematch` | shipped Chromium/Firefox | **live** | the only *machine-checkable* progressive-disclosure primitive on the web |
| **`interestfor` (Open UI / WHATWG PR #11006)** | Declarative "show interest" (hover/focus/long-press) → reveal a `popover=hint`; `interest-delay-start/end`, `:interest-source`, `::interest-button` | explainer updated 2026-08-18; not yet merged into HTML | **proposal** | the platform formalising *low-commitment attention* as a first-class state |
| **`text-wrap-style`** | `auto \| balance \| pretty \| stable` (+ spec'd `avoid-short-last-line`) | CSS Text L4; shipped Chromium/Firefox | **live** | proof the platform will accept *declared typographic intent* with the engine choosing values |
| **NN/g "Progressive Disclosure"** (Nielsen, 2006-12-03) | Two-level split: a few most-important options up front, the rest on request | the canonical citation, 20 years old | **live guidance** | supplies the *research* claim our `data-collapse` implicitly assumes — and one hard limit |
| **Deep saliency models** (SalGAN, MSI-Net, TranSalNet, SaRa) | Predict human fixation density from an image | research code; no production UI-tooling adoption found | **research** | the only candidate for a *perceptual* attention oracle, and it does not survive scrutiny (§Wrong #5) |

---

## Consolidated table — every shipped attention / priority enumeration found

This is the raw material for an `@nisli/next` vocabulary. Values are copied verbatim from
the primary source; ordering is as documented.

| system | attribute / API | exact values (in documented order) | numeric | what the value *means* |
|---|---|---|---|---|
| Android | `NotificationManager.IMPORTANCE_*` | `IMPORTANCE_UNSPECIFIED`, `IMPORTANCE_NONE`, `IMPORTANCE_MIN`, `IMPORTANCE_LOW`, `IMPORTANCE_DEFAULT`, `IMPORTANCE_HIGH`, `IMPORTANCE_MAX` | `-1000`, `0`, `1`, `2`, `3`, `4`, `5` | escalating permission to intrude: not-in-shade → below-the-fold → silent-in-shade → noise → noise+peek → reserved-for-OS |
| Apple (UserNotifications) | `UNNotificationInterruptionLevel` | `passive`, `active`, `timeSensitive`, `critical` | enum | passive = list only; active = screen+sound; timeSensitive = **breaks through system notification controls**; critical = **bypasses the mute switch** |
| Android (interruption side) | `NotificationManager.INTERRUPTION_FILTER_*` | `INTERRUPTION_FILTER_UNKNOWN`, `_ALL`, `_PRIORITY`, `_ALARMS`, `_NONE` | `0`, `1`, `2`, `3`, `4` | the *receiver's* budget, not the sender's claim — a second, dual axis |
| W3C ARIA | `aria-live` | `off` (default), `polite`, `assertive` | — | `off` = only if focused; `polite` = "next graceful opportunity"; `assertive` = "highest priority… immediately", may clear the speech queue |
| W3C ARIA (implicit) | role defaults | `role="alert"` ⇒ `aria-live: assertive` + `aria-atomic: true`; `role="log"` ⇒ `aria-live: polite` | — | **the level is derived from the declared role** — precisely the C10 move |
| AppKit | `NSToolbarItem.VisibilityPriority` | `low`, `standard` (default), `high`, `user` | raw ints exist but are not published in the current docs — `[UNVERIFIED]` | survival order under space pressure; `user` = highest, reserved for user-customised items |
| WinUI / Windows App SDK | `ICommandBarElement.DynamicOverflowOrder` | `int` (author-assigned) | `int` | "the order in which a primary command … should be moved to the overflow menu when there is not enough room" |
| WinUI | `CommandBar.PrimaryCommands` / `.SecondaryCommands` | two buckets | — | a *binary* importance declaration that predates the ordinal one and still coexists with it |
| WinUI | `AppBarClosedDisplayMode` | `Compact` (default), `Minimal`, `Hidden` | enum | how much of the bar survives when *closed* — a density/disclosure axis, orthogonal to priority |
| Windows Ribbon | `<Scale Size=…>` | `Large`, `Medium`, `Small`, `Popup` | — | a **declared degradation ladder** per group; must be listed in descending size order |
| Fluent UI (web) | `OverflowItemProps` | `priority?: number` **XOR** `pinned?: boolean` | number | "A higher priority means the item overflows later"; `pinned` = "will never overflow and will always be visible" |
| Fluent UI (web) | `OverflowGroupState` | `visible`, `hidden`, `overflow` | — | tri-valued *group* state — a group can be wholly present, wholly gone, or partly in the menu |
| Fluent UI (web) | `OverflowDirection` / `OverflowAxis` | `start \| end` / `horizontal \| vertical` | — | which end sheds first, and along which axis |
| KDE Kirigami | `Action.displayHint` (`DisplayHint::Hint`) | `NoPreference`, `IconOnly`, `KeepVisible`, `AlwaysHide`, `HideChildIndicator` | `0`, `1`, `2`, `4`, `8` (flags) | *capabilities*, not a rank: "try to keep visible even when space constrained" / "if possible, hide … in an overflow menu"; combinable with bitwise OR |
| CSS Display L4 | `reading-flow` | `normal`, `source-order`, `flex-visual`, `flex-flow`, `grid-rows`, `grid-columns`, `grid-order` | — | which traversal order the container imposes on its children |
| CSS Display L4 | `reading-order` | `<integer>`, initial `0` | int | "which ordinal group the item belongs to… ordered starting from the lowest numbered ordinal group and going up" |
| CSS Display L4 | `visibility` | `visible`, `hidden`, `force-hidden`, `collapse` | — | `force-hidden` is new in L4 — an *un-overridable* hide |
| CSS Contain L2 | `content-visibility` | `visible`, `auto`, `hidden` | — | `auto` = skip rendering when "not relevant to the user" but stay findable; `hidden` = skip and be unfindable |
| HTML | `hidden` | `hidden` (or empty/invalid), `until-found` | — | `until-found` = present-but-deferred, revealed by find-in-page/fragment nav, announced by `beforematch` |
| SwiftUI | `Prominence` | `standard`, `increased` | enum | contextual emphasis applied to a *hierarchy*, via `.headerProminence(_:)` |
| Adobe Spectrum | `variant` × `treatment` | `accent \| primary \| secondary \| negative` × `fill \| outline` | — | semantic role × emphasis strength, factored |
| Adobe Spectrum | `static-color` | `white`, `black` | — | "I am on an image/ backdrop, stop deriving my colour from the surface" |
| Material 3 | button types | elevated, filled, filled-tonal, outlined, text | — | emphasis as five *distinct components* |
| CSS Text L4 | `text-wrap-style` | `auto`, `balance`, `pretty`, `stable`, (spec'd) `avoid-short-last-line` | — | declared typographic *quality target*; the engine picks the break points |
| Open UI (proposal) | `interestfor` + `interest-delay-start/end` | attribute + two `<time>` properties, both default `0.5s` | — | a declared *threshold of attention* before content is revealed |

**Reading of the table.** Three distinct axes are hiding in here and every shipped system
picks exactly one:

- **A. Survival order** — who dies first when space runs out. `NSToolbarItem.VisibilityPriority`,
  `DynamicOverflowOrder`, Fluent `priority`/`pinned`, Ribbon `<Scale>`. **This is our
  `data-priority`.**
- **B. Interruption budget** — how much of the user's current task I may destroy.
  Android `IMPORTANCE_*`, iOS `UNNotificationInterruptionLevel`, `aria-live`. **We have
  nothing here.**
- **C. Emphasis / prominence** — how loud I am when everything fits. Spectrum
  `variant`×`treatment`, SwiftUI `Prominence`, M3 button types. **This is our
  `data-role`, and it is currently a flat list, not a scale.**

Nobody ships all three. A vocabulary that names all three *and keeps them orthogonal*
would be genuinely new — and is also the obvious way to end up with three overlapping
integers nobody can reason about (§Wrong #4).

---

## What each one actually does

### 1. `@fluentui/priority-overflow` — the shipped version of our fit solver

390k downloads/week, and the mechanism is a two-priority-queue swap driven by a
`ResizeObserver`. The comparator is the whole design:

```js
// @fluentui/priority-overflow@9.4.3 · lib/overflowManager.js:52-73
function compareItems(lt, rt) {
    if (!lt || !rt) { return 0; }
    const lte = overflowItems[lt];
    const rte = overflowItems[rt];
    if (!lte || !rte) { return lte ? 1 : -1; }
    // Pinned items have "infinite" priority - they should never be hidden
    if (lte.pinned !== rte.pinned) { return lte.pinned ? 1 : -1; }
    if (lte.priority !== rte.priority) { return lte.priority > rte.priority ? 1 : -1; }
    // Node.DOCUMENT_POSITION_FOLLOWING = 4, Node.DOCUMENT_POSITION_PRECEDING = 2
    const positionStatusBit = options.overflowDirection === 'end' ? 4 : 2;
    return lte.element.compareDocumentPosition(rte.element) & positionStatusBit ? 1 : -1;
}
```

Read the three tiers: **pinned beats priority beats document position**. That is exactly
the round-5 correction our own proof was forced into ("ties broke by DOM order and hid the
wrong action") — except Fluent makes the DOM-order tie-break *direction-aware*
(`overflowDirection: 'start' | 'end'`), which our prototype does not.

The API is a discriminated union, so `pinned` and `priority` are **mutually exclusive at
the type level**:

```ts
// @fluentui/priority-overflow-consuming react-overflow · OverflowItem.types.ts
} & (
  | { /** If true, the item will never overflow and will always be visible.
       *  Mutually exclusive with `priority`. */
      pinned?: boolean; priority?: never; }
  | { pinned?: never;
      /** A higher priority means the item overflows later. Mutually exclusive with `pinned`. */
      priority?: number; }
);
```

The solve loop is where the honesty is:

```js
// lib/overflowManager.js:154-186 (abridged)
const availableSize = getClientSize(container) - options.padding;
while (compareItems(invisibleItemQueue.peek(), visibleItemQueue.peek()) > 0) { hideItem(); }
// Run the show/hide step twice - the first step might not be correct if
// it was triggered by a new item being added - new items are always visible by default.
for (let i = 0; i < 2; i++) {
    while (occupiedSize() < availableSize && invisibleItemQueue.size() > 0
           || invisibleItemQueue.size() === 1 // attempt to show the last invisible item hoping
                                              // it's size does not exceed overflow menu size
    ) { showItem(); }
    while (occupiedSize() > availableSize && visibleItemQueue.size() > options.minimumVisible) {
        const nextItemId = visibleItemQueue.peek();
        if (nextItemId && overflowItems[nextItemId]?.pinned) { break; }
        hideItem();
    }
}
```

Three things a design review should not skip:

1. **The loop runs twice, by fiat**, with a comment admitting the first pass may be wrong.
2. **`invisibleItemQueue.size() === 1` is a guess** — verbatim: *"attempt to show the last
   invisible item hoping it's size does not exceed overflow menu size"*.
3. **`padding` defaults to `10`** and is documented as *"Padding in pixels reserved at the
   end of the container before overflow occurs. Useful for accounting for extra elements
   (for example an overflow menu button) or margins between items that are difficult to
   measure in JavaScript."*

That third one is the load-bearing admission: **Microsoft's shipped priority-overflow
engine carries a 10px magic constant because measuring is unreliable.** Our own F10
("a solver must measure the world it creates") is the same defect, and Fluent's answer was
a fudge factor rather than a fix.

It also has a **tri-valued group state** — `type OverflowGroupState = 'visible' | 'hidden' |
'overflow'` — plus registered `divider` entries that hide themselves when their group's
last visible item leaves. Our prototype's round-5 correction ("collapse must apply to a
declared *group*") is the same discovery, arrived at independently.

### 2. AppKit `NSToolbarItem.VisibilityPriority` — the tie-break, documented

Overview text, verbatim:

> When a toolbar doesn't have enough space to fit all its items, it pushes items into the
> overflow menu to make space. Use these constants to suggest a priority for individual
> toolbar items. The toolbar pushes low-priority items to the overflow menu first, followed
> by standard items and high-priority items. **When two or more items share the same
> priority, the toolbar pushes the one closest to the trailing edge first.**

And per-constant:

> **`low`** — The lowest-priority for a toolbar item. *The toolbar pushes items with this
> priority to the overflow menu first, even before items with the `standard` priority.*
> **`user`** — The highest priority for items in the toolbar.

Two design notes. (a) The scale is four levels and the top one, `user`, is **not for the
developer** — it is what the framework assigns to items the *user* dragged into the
toolbar. A shipped attention scale reserves its top level for a non-author actor. (b) The
struct conforms to `Comparable`, so priorities are *ordered*, not merely tagged.

### 3. Windows Ribbon — the only shipped general degradation ladder, and the warning

The Ribbon is the closest thing in existence to C11's ambition: a *declarative* adaptive
layout for a whole command surface, in XML, shipped in Windows 7.

```xml
<!-- learn.microsoft.com/windows/win32/windowsribbon/windowsribbon-element-scalingpolicy -->
<Tab CommandName="Home">
  <Tab.ScalingPolicy>
    <ScalingPolicy>
      <ScalingPolicy.IdealSizes>
        <Scale Group="GroupClipboard" Size="Medium"/>
        <Scale Group="GroupView"      Size="Large"/>
        <Scale Group="GroupFont"      Size="Large"/>
        <Scale Group="GroupParagraph" Size="Large"/>
      </ScalingPolicy.IdealSizes>
      <Scale Group="GroupClipboard" Size="Small"/>
      <Scale Group="GroupClipboard" Size="Popup"/>
      <Scale Group="GroupFont"      Size="Medium"/>
      <Scale Group="GroupParagraph" Size="Medium"/>
    </ScalingPolicy>
  </Tab.ScalingPolicy>
  <Group CommandName="GroupClipboard" SizeDefinition="FourButtons">…</Group>
</Tab>
```

The framework's own description of what this buys:

> Adaptive layout, as defined by the Ribbon framework, is the ability of all controls within
> the ribbon UI to dynamically adjust their organization, size, format, and relative scale
> based on changes to the size of the ribbon at run time.

Now the four costs, all quoted:

- **The ladder is hand-authored and order-sensitive.** *"The list of `Scale` declarations
  must be in descending order of valid sizes (Large, Medium, Small, Popup)."*
- **The layout templates are a closed catalogue with hard arity.** `OneButton`,
  `TwoButtons`, `ThreeButtons`, `ThreeButtons-OneBigAndTwoSmall`,
  `ThreeButtonsAndOneCheckBox`, `FourButtons`, `FiveButtons`, `FiveOrSixButtons`,
  `SixButtons`, `SixButtons-TwoColumns`, `SevenButtons`, `EightButtons`,
  `EightButtons-LastThreeSmall`, `NineButtons`, `TenButtons`, `ElevenButtons`,
  `OneFontControl`, … — one template per *count of buttons*.
- **Mismatch is a compile error.** *"If the controls declared in markup do not map exactly
  to control type, order, and quantity defined in the associated template, a validation
  error is logged by the markup compiler and compilation is terminated."*
- **Fitting narrow is the author's problem.** *"It is highly recommended that adequate
  scaling policy detail be specified such that a Ribbon is able to render without scroll
  bars when resized to a width of 300 pixels at 96 dots per inch (dpi)."*

And the automatic mode — the one that would be C11 — is explicitly disclaimed:

> The Ribbon framework provides default layout behaviors based on a set of built-in
> heuristics for the organization and presentation of controls at run time without the need
> for the predefined `SizeDefinition` templates. **However, this capability is intended for
> prototyping purposes only.**

That sentence is the single most important line in this document. Microsoft built the
automatic resolver, shipped it, and told developers not to use it in production.

### 4. WinUI `CommandBar` — priority as an `int`, plus a binary bucket that never went away

```csharp
// ICommandBarElement.DynamicOverflowOrder — Windows App SDK 0.8 → 2.0
public int DynamicOverflowOrder { get; set; }
```

> Gets or sets a value that indicates the order in which a primary command in a `CommandBar`
> should be moved to the overflow menu when there is not enough room to display all primary
> commands.

The conceptual doc adds the *authoring* instruction, which is the interesting part:

> By default, command bar items are added to the `PrimaryCommands` collection. **You should
> add commands in order of their importance so that the most important commands are always
> visible.** When the command bar width changes, such as when users resize their app window,
> primary commands dynamically move between the command bar and the overflow menu at
> breakpoints.

Note what that sentence concedes: even with an explicit ordinal API available, the
*documented default* is "encode importance in DOM order". And the tail: *"On the smallest
screens (320 epx width), a maximum of 4 primary commands fit in the command bar."* — a
hard-coded capacity figure in the guidance, not derived.

`AppBarClosedDisplayMode` (`Compact` / `Minimal` / `Hidden`) is a second, orthogonal
disclosure axis on the same control, and the doc closes with a usability warning that reads
directly onto `data-collapse`: *"Although the Minimal and Hidden modes are useful in some
situations, keep in mind that hiding all actions could confuse users."*

### 5. Primer (`@primer/react`) — overflow *without* a priority vocabulary

GitHub's `ActionBar` and `UnderlineNav` implement overflow with **no importance
declaration whatsoever**. There is no `priority`, no `pinned`, no ordering prop anywhere in
`ActionBarProps`:

```ts
// @primer/react@38.36.0 · dist/ActionBar/ActionBar.d.ts
type ActionBarProps = {
  size?: Size;              // 'small' | 'medium' | 'large'
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
  gap?: GapScale;           // 'none' | 'condensed'
} & A11yProps;
```

The mechanism is a shared `IntersectionObserver` that reports *clipping*, not a solver:

```js
// @primer/react@38.36.0 · dist/internal/hooks/useOverflowObserver.js
/**
 * Track whether `ref`'s element is currently clipped (overflowing) by the nearest
 * `OverflowObserverProvider`'s root-scoped `IntersectionObserver`.
 * Returns `false` when there is no surrounding provider, during SSR, when
 * `IntersectionObserver` is unavailable, or when `disabled` is set.
 */
…
/** Stable server snapshot for `useIsClipped`: overflow is never measured during SSR. */
const getOverflowServerSnapshot = () => false;
```

Two conclusions we should take seriously. First: **CSS does the layout, the observer only
reports the verdict, and the overflowing items are re-rendered into an `ActionMenu`.** No
measurement loop, no magic padding, no two-pass. It is a strictly cheaper design than
Fluent's and it works because the *order* question is answered by "DOM order, always".
Second: `getOverflowServerSnapshot = () => false` is GitHub's answer to flash-of-unfit —
**assume nothing overflows on the server and accept the client-side correction.** That is
directly relevant to our unproven "SSG pre-solve" item.

### 6. Android `IMPORTANCE_*` — the best-specified attention scale that exists

Every level is defined by *consequence*, not by adjective. Verbatim from the API reference:

| constant | value | documented meaning |
|---|---|---|
| `IMPORTANCE_UNSPECIFIED` | `-1000` | "Value signifying that the user has not expressed an importance." |
| `IMPORTANCE_NONE` | `0` | "A notification with no importance: does not show in the shade." |
| `IMPORTANCE_MIN` | `1` | "Min notification importance: only shows in the shade, below the fold." |
| `IMPORTANCE_LOW` | `2` | "Low notification importance: Shows in the shade, and potentially in the status bar …, but is not audibly intrusive." |
| `IMPORTANCE_DEFAULT` | `3` | "Default notification importance: shows everywhere, makes noise, but does not visually intrude." |
| `IMPORTANCE_HIGH` | `4` | "Higher notification importance: shows everywhere, makes noise and peeks. May use full screen intents." |
| `IMPORTANCE_MAX` | `5` | "…May have elevated prominence in appearance or shade ranking. **Usage is reserved by OS; app usage is capped at `IMPORTANCE_HIGH`.**" |

Three transferable design decisions:

1. **The top of the scale is not available to the author.** Same move as AppKit's `user`
   priority. A scale whose maximum anyone can claim is a scale everyone claims.
2. **There is an explicit "the author did not say" sentinel** (`-1000`), distinct from
   "the author said zero". Our `data-priority` currently has no such distinction.
3. **Importance is declared on the *channel*, not the message** — `NotificationChannel.
   getImportance()`. The user owns the channel's level; the app owns which channel a
   message goes to. That is a *negotiated* attention model, not a declared one.

### 7. iOS interruption levels + `aria-live` — attention as a permission, not a size

`UNNotificationInterruptionLevel`, verbatim ("Constants that indicate the importance and
delivery timing of a notification"):

- `passive` — "The system adds the notification to the notification list without lighting up the screen or playing a sound."
- `active` — "The system presents the notification immediately, lights up the screen, and can play a sound."
- `timeSensitive` — "…and **breaks through system notification controls**."
- `critical` — "…and **bypasses the mute switch** to play a sound."

`aria-live` is the same idea with three levels, and it is *normative web platform*:

- `assertive` — "Indicates that updates to the region have the highest priority and should be presented to the user immediately."
- `off` (default) — "Indicates that updates to the region should **not** be presented to the user unless the user is currently focused on that region."
- `polite` — "Indicates that updates to the region should be presented at the next graceful opportunity, such as at the end of speaking the current sentence or when the user pauses typing."

MDN's warning is the design constraint in one line:

> Because an interruption may disorient users or cause them to not complete their current
> task, don't use the `assertive` value unless the interruption is imperative.

And the piece that is *exactly the C10 thesis*, from the ARIA 1.3 spec:

> Elements with the role `alert` have an implicit `aria-live` value of `assertive`, and an
> implicit `aria-atomic` value of `true`.
> Elements with the role `log` have an implicit `aria-live` value of `polite`.

**The level is derived from the declared role.** That is not an analogy — it is a shipped,
normative instance of "declare what a thing *is*, and the framework resolves the numeric
policy". Our strongest precedent, and it is in the web platform already.

### 8. CSS `reading-flow` / `reading-order` — the right shape, the wrong plane

```
reading-flow: normal | source-order | flex-visual | flex-flow | grid-rows | grid-columns | grid-order
             initial: normal · applies to: block, flex and grid containers · inherited: no

reading-order: <integer>
             initial: 0 · applies to: Direct block-level, grid item, or flex item children
                          of a reading flow container · inherited: no
```

> The `reading-order` property lets the author change where in the reading flow an item is
> visited, overriding the position set by the `reading-flow` property on its parent. It
> takes a single `<integer>` value, which specifies which ordinal group the item belongs to.
> Sibling elements are ordered starting from the lowest numbered ordinal group and going up.
> **If the reading order of two items is equivalent, the `reading-flow` property breaks the tie.**

That is the cleanest priority-declaration design in the entire survey: a *container policy*
plus a *per-child integer ordinal group* plus an *explicit tie-break delegated back to the
container*. Compare our `data-priority` + implicit-DOM-order and the difference is that CSS
names the tie-break as a first-class container property.

But the disclaimer is unambiguous:

> The `reading-flow` property affects neither layout nor painting order and therefore has no
> effect on rendering to the visual canvas.

and the design intent note:

> **The source document should express the underlying logical order of elements.** The
> `reading-flow` and `reading-order` properties exist for cases where a given document can
> have multiple reading orders depending on layout changes, e.g. in response to media
> queries.

So: excellent grammar to borrow, and it is an *assistive-technology traversal* feature. Any
claim that it is "the standards-track version of our attention thesis" is false.

### 9. Emphasis vocabularies — Spectrum factors it; Material does not

Adobe Spectrum's button splits what everyone else conflates:

```ts
// @spectrum-web-components/button@1.12.2 · src/Button.d.ts
export type ButtonVariants = 'accent' | 'primary' | 'secondary' | 'negative' | ButtonStaticColors | …;
export type ButtonStaticColors = 'white' | 'black';
export type ButtonTreatments = 'fill' | 'outline';
```

with defaults `variant = "accent"`, `treatment = "fill"`. Note the deprecations, which are
the *evidence*: `cta` → `accent`; `overBackground` → `static-color="white"` +
`treatment="outline"`; `quiet` → deprecated outright. Spectrum spent a major version
*decomposing* fused appearance names into orthogonal axes. That is a strong signal for our
vocabulary design and against `role="quiet"` as a primitive.

SwiftUI's `Prominence` is the minimal version — `standard | increased` — and it is applied
to a *hierarchy* (`.headerProminence(.increased)`), not to a control. Emphasis as a
contextual modifier, not a per-widget prop.

Material 3 goes the other way: five button *components* ordered by emphasis (elevated,
filled, filled-tonal, outlined, text) with prose guidance rather than a scale —
*"Elevated buttons are essentially filled tonal buttons with a shadow. To prevent shadow
creep, only use them when absolutely necessary."* For an agent that has to choose from a
menu, five component names carrying an unstated ordering is the worst of the three shapes.

### 10. Progressive disclosure — the research, and its ceiling

Nielsen, 2006-12-03, verbatim:

> 1. Initially, show users **only a few** of the most important options.
> 2. Offer a **larger set** of specialized options upon request.

> In a system designed with progressive disclosure, the very fact that something appears on
> the initial display tells users that it's **important**.

That last sentence is the justification for `data-priority` having a *visual* consequence at
all. But the same article states the ceiling, and it is a hard number:

> In theory, there's no reason why you can't have **multiple levels of progressive
> disclosure**. … **In practice, designs that go beyond 2 disclosure levels typically have
> low usability because users often get lost when moving between the levels.**

and the harder requirement:

> You must get the right **split between initial and secondary features**. … Task analysis
> and field studies can give you insights into what people need … **frequency-of-use
> statistics** can help you prioritize the features.

Read that as a requirement on us: NN/g's answer to "which things are least important" is
*measured user behaviour*, not author declaration. The author-declared integer is a proxy
whose accuracy nobody checks.

The web's *machine-checkable* disclosure primitives are narrow but real:
`content-visibility: visible | auto | hidden`, and `hidden="until-found"` (implemented via
`content-visibility: hidden`, so — critically — **the element still generates a box,
participates in layout, and renders its margin/border/background**, unlike `hidden`). Both
are declarative, both have observable DOM consequences (`beforematch`,
`contentvisibilityautostatechange`), and both are therefore assertable.

### 11. `text-wrap-style` — the platform accepting declared intent over declared values

`auto | balance | pretty | stable` (+ spec'd `avoid-short-last-line`). MDN's descriptions
are the proof that the platform will ship "say what you want, we'll pick the numbers":
`balance` = "wrapped in a way that best balances the number of characters on each line";
`pretty` = "a slower algorithm that favors better layout over speed … for body copy where
good typography is favored over performance". And the cost is stated: `balance` is
"only supported for blocks of text spanning a limited number of lines (six or less for
Chromium and ten or less for Firefox)". Declared-intent typography ships with a *documented
scope limit*, not an unbounded promise.


### 12. Vaadin `menu-bar` and `details-menu-element` — the third and fourth data points on "no priority"

`@vaadin/menu-bar` (70,017/wk) does overflow with **a direction and nothing else**:

```ts
// @vaadin/menu-bar@25.2.8 · src/vaadin-menu-bar-mixin.d.ts:179-184
/**
 * If true, the buttons will be collapsed into the overflow menu
 * starting from the "start" end of the bar instead of the "end".
 * @attr {boolean} reverse-collapse
 */
reverseCollapse: boolean | null | undefined;
```

and the loop is a plain measured shed from one end, with the direction as the only author input:

```js
// src/vaadin-menu-bar-mixin.js:510-523 (abridged)
const remaining = [...buttons];
while (remaining.length) {
  const lastButton = remaining[remaining.length - 1];
  const btnLeft = lastButton.offsetLeft - containerLeft;
  …
  const btn = this.reverseCollapse ? remaining.shift() : remaining.pop();
  // Save width for buttons with component
  btn.style.width = getComputedStyle(btn).width;
}
```

`@github/details-menu-element` (63,639/wk) is included only to record what it is *not*: a
`<details>`/`<summary>` disclosure widget with `role="menu"` semantics, no priority, no
measurement, no adaptation. It is progressive disclosure shipped as a component — evidence
that the *disclosure* half of the problem is considered solved by markup, and the
*adaptation* half is where all the machinery lives.

Tally across the four web implementations: Fluent has `priority` + `pinned` + direction;
Vaadin has direction only; Primer has neither; `details-menu` has nothing. **Direction is
the only input all the adaptive ones share.**
---

### 13. KDE Kirigami `DisplayHint` — importance as flags, with the sentinel we were missing

The only system in the survey that refuses the ordinal entirely:

```cpp
// KDE/kirigami · src/layouts/displayhint.h
enum Hint : uint {
    NoPreference = 0,
    IconOnly = 1,
    KeepVisible = 2,
    AlwaysHide = 4,
    HideChildIndicator = 8,
};
Q_DECLARE_FLAGS(DisplayHints, Hint)
```

with the semantics stated in the header's own doc comment:

> - `NoPreference`: Indicates there is no specific preference.
> - `IconOnly`: Only display an icon for this Action
> - `KeepVisible`: Try to keep the action visible even when space constrained. **Mutually
>   exclusive with `AlwaysHide`, `KeepVisible` has priority.**
> - `AlwaysHide`: If possible, hide the action in an overflow menu or similar location.
>   Mutually exclusive with `KeepVisible`, `KeepVisible` has priority.

and the consumer, verbatim from `src/controls/ActionToolBar.qml`:

> The default behavior of ActionToolBar is to display as many items as possible, placing the
> ones that don't fit into an overflow menu. You can control this behavior by setting the
> `displayHint` property on an item's Action. For example, when setting the
> `DisplayHint.KeepVisible` display hint, ActionToolBar will try to keep that action's item
> in view as long as possible, **transforming it into an icon-only button if a button with an
> icon and text doesn't fit.**

Four things worth extracting:

1. **There is no number.** The author says *what may happen to me* (`IconOnly` is allowed;
   `KeepVisible` is preferred; `AlwaysHide` is preferred), not *where I rank*. Everything
   unmarked is simply solved by fit. This is the closest thing in the prior art to
   "declare capability, let the engine order" — and it sidesteps the collision problem an
   `int` has when independently-generated components meet.
2. **`NoPreference = 0` is the "not stated" sentinel**, invented independently of Android's
   `IMPORTANCE_UNSPECIFIED = -1000`. Two vendors, two domains, same conclusion.
3. **Mutual exclusivity is documented *with a resolution rule*** (`KeepVisible` wins), and
   there is a shipped helper — `displayHintSet()` — whose stated purpose is *"to enforce
   certain behaviour of the various display hints, primarily the mutual exclusivity of
   `KeepVisible` and `AlwaysHide`"*. Contradictory declarations are expected and adjudicated
   in one documented place rather than being an error.
4. **A per-item degradation strategy is part of the hint** (`IconOnly`), not a separate
   attribute. That is our `data-collapse` fused into the same declaration, and it means the
   engine's ladder for that item is `full → icon-only → overflow menu` with no extra
   authoring.

Also note Kirigami's own overflow trigger declares itself:
`displayHint: KL.DisplayHint.IconOnly | KL.DisplayHint.HideChildIndicator`. The affordance
is a participant in the same vocabulary — which is exactly the F10 lesson (*"a solver must
measure the world it creates"*) expressed as an API rather than as a bug fix.


## Ideas worth stealing

1. **A three-tier comparator, with `pinned` as a distinct kind rather than a big number.**
   *From:* `@fluentui/priority-overflow` `compareItems` (pinned → priority → document
   position, direction-aware). *Why it applies:* an agent that wants "never hide Save"
   currently has to invent `priority="9999"`, which is unbounded, unvalidatable and
   collides. `pinned` as a separate boolean, **mutually exclusive with `priority` at the
   type level**, makes the intent expressible in a closed vocabulary and makes
   "everything is pinned" a *countable* smell — exactly the escape-ratio metric shape C11
   §2.3 already proposes.

2. **Name the tie-break as a container property, not as an implicit DOM fact.**
   *From:* CSS `reading-flow` — *"If the reading order of two items is equivalent, the
   `reading-flow` property breaks the tie"* — and AppKit's *"the toolbar pushes the one
   closest to the trailing edge first"*. *Why it applies:* our round-5 correction was
   precisely a tie-break bug. A declaration-only framework must make the tie-break
   *declared* (`data-collapse-from="end|start"`), because otherwise the author's only lever
   is to reorder the DOM — which is the structure-coupling C10 exists to abolish.

3. **Derive the level from the declared role, and let the explicit attribute be the
   override.** *From:* ARIA — `role="alert"` ⇒ implicit `aria-live: assertive`;
   `role="log"` ⇒ implicit `polite`. *Why it applies:* this is the C10 thesis running in
   production in a W3C normative spec. `data-appearance="action" data-role="primary"`
   should *imply* a survival priority; `data-priority` should exist only to contradict the
   default. That collapses the common case to zero attributes and makes every explicit
   `data-priority` a reviewable decision.

4. **Reserve the top of the scale for a non-author actor.** *From:* Android
   (`IMPORTANCE_MAX` — *"Usage is reserved by OS; app usage is capped at
   `IMPORTANCE_HIGH`"*) and AppKit (`VisibilityPriority.user`). *Why it applies:* in an
   agent-authored codebase, every generated component will claim maximum importance for
   its own subtree, because each is generated in isolation. A ceiling the author cannot
   reach is the only structural defence, and it also reserves a slot for a *user/context*
   override later (art direction, §7.20).

5. **Ship an explicit "not stated" sentinel, distinct from zero.**
   *From:* `IMPORTANCE_UNSPECIFIED = -1000` — *"Value signifying that the user has not
   expressed an importance."* — and, independently, Kirigami's `DisplayHint::NoPreference = 0`,
   *"Indicates there is no specific preference."* *Why it applies:* the framework's own checker needs to
   distinguish "the author declared this least important" from "the author never thought
   about it". Only the second is a diagnostic. With a bare `int` defaulting to `0` we
   cannot tell them apart, so we can never emit the most useful warning in the whole system:
   *"this container degrades and no child declared relative importance."*

6. **Group state is tri-valued, and dividers are participants.**
   *From:* `OverflowGroupState = 'visible' | 'hidden' | 'overflow'`, plus registered
   `OverflowDividerEntry` that flips `data-overflowing` when its group's last visible item
   leaves. *Why it applies:* our proof already forced "collapse applies to a declared
   group". Fluent shows the second half we have not done: **separators are members of the
   group and must be solved with it**, otherwise a fitted row ends with a dangling divider —
   a defect with a real geometric signature that our `crush`/`overlap` paths would not flag.

7. **Degrade presentation, preserve access.** *From:* every shipped system.
   Android `IMPORTANCE_MIN` = *"only shows in the shade, below the fold"* (still reachable);
   toolbars move items to an overflow *menu* (still reachable); `hidden="until-found"` keeps
   content findable by find-in-page and fires `beforematch`. *Why it applies:* our
   `data-collapse="hide"` **destroys reachability**, and nothing in the prototype asserts
   that a hidden thing is still obtainable. `hidden="until-found"` is a shipped, standard,
   *checkable* alternative for text: it keeps a box, keeps find-in-page, and announces its
   own reveal.

8. **Factor emphasis into orthogonal axes and delete the fused names.**
   *From:* Spectrum's migration — `cta` → `accent`; `overBackground` →
   `static-color="white"` + `treatment="outline"`; `quiet` deprecated. *Why it applies:* our
   `data-role="quiet"` is exactly the fused name Adobe removed. Two orthogonal axes
   (`role: action|danger|link` × `emphasis: filled|outlined|plain`) span the same space with
   fewer entries, compose predictably, and give the checker a cardinality invariant to
   assert (§Wrong #5 lists the one that is actually decidable).

9. **A declared *quality target* is a legitimate primitive, if you also declare its scope
   limit.** *From:* `text-wrap-style: balance | pretty | stable`, shipped with an explicit
   line-count ceiling (six lines Chromium / ten Firefox). *Why it applies:* it is the
   platform's own precedent for "declare intent, engine picks numbers", and the lesson is
   that it shipped **with a stated bound**. Any `@nisli/next` intent primitive should ship
   its bound in the same breath.

10. **Assume no overflow on the server, correct on the client — and say so.**
    *From:* Primer, verbatim: *"Stable server snapshot for `useIsClipped`: overflow is never
    measured during SSR."* *Why it applies:* it is a shipped answer to our unproven
    "SSG pre-solve" item, from the highest-traffic design system on the web, and it costs
    one line. It converts flash-of-unfit from an unsolved risk into a *declared, testable
    policy* — and it means the first paint is exactly "everything visible", which is the
    only starting state a checker can reason about.

11. **A declared threshold before attention is spent.** *From:* `interest-delay-start` /
    `interest-delay-end`, both defaulting to `0.5s`, plus `:interest-source`. *Why it
    applies:* if `@nisli/next` wants to reason about attention rather than only about space,
    the platform is already standardising the unit — *time before disclosure* — as a CSS
    property with an author default and a **UA override for user need** (*"the UA is allowed
    to modify delays, as needed, to be a proper agent for the user"*). Same negotiated shape
    as Android's channel model.

---

## Where the prior art says we are wrong

### 1. The closest thing ever built to C11 shipped, and its vendor told people not to use it

The Windows Ribbon framework has an automatic mode that does what C11 promises — resolve
adaptive layout from declared structure with no per-tab manifest. Microsoft's own
documentation:

> The Ribbon framework provides default layout behaviors based on a set of built-in
> heuristics for the organization and presentation of controls at run time without the need
> for the predefined `SizeDefinition` templates. **However, this capability is intended for
> prototyping purposes only.**

What they shipped for production instead is *more* authoring than Tailwind: a hand-ordered
`ScalingPolicy` ladder per tab, a closed catalogue of ~17 layout templates keyed by button
count, a **compilation-terminating validation error** when your controls do not match the
template exactly, and a documented instruction to hand-verify that it survives 300px.

This is the strongest adversarial finding in the slice. It does not prove C11 is impossible.
It does establish that (a) a major vendor with unlimited resources built the automatic
resolver, (b) shipped it, (c) judged its output not good enough for production, and (d) the
production path they *did* ship converged on hand-authored per-surface degradation ladders.
Our §5.4 weighting says the resolution table is ~40% of the bet and "beauty is not
derivable". Microsoft reached the same conclusion in 2009 and priced it at a full manual
ladder per tab.

### 2. The most agent-visible design system on the web ships overflow with *no* priority at all

`@primer/react` is GitHub's system — the highest-visibility, highest-corpus-density React
component set in existence for an agent. Its `ActionBar` and `UnderlineNav` do overflow, at
scale, in production, with an `IntersectionObserver` and **zero importance vocabulary**:
no `priority`, no `pinned`, no ordering prop in `ActionBarProps`. Items overflow in DOM
order, full stop.

`@vaadin/menu-bar` (70,017/wk) is the same verdict from a third vendor: its only author
input is `reverseCollapse`, a **direction**, and it sheds from one end by measurement with no
per-item ordinal at all.

And WinUI — which *does* have `DynamicOverflowOrder` — still tells authors in its primary
conceptual doc: *"You should add commands in order of their importance so that the most
important commands are always visible."*

The uncomfortable reading: **DOM order already encodes importance well enough that three
major vendors either never added the declaration or don't lead with it.** If `data-priority` is
mostly redundant with "write them in order", then it is a vocabulary entry that costs
context budget, invites inconsistency between generated components, and buys a case
(non-monotonic importance vs. reading order) that may be rare. Before it ships, someone
should count how often the two orders actually disagree in real surfaces.

### 3. Measurement-based fit does not converge cleanly, and the shipped fix is a fudge factor

We treated our F10 ("a solver must measure the world it creates") as a bug we found and
closed. Fluent's 390k-download-per-week engine has the same class of problem and did **not**
close it:

- the show/hide pass **runs twice by fiat**, with a source comment conceding the first pass
  may be wrong;
- one branch is a documented guess — *"attempt to show the last invisible item hoping it's
  size does not exceed overflow menu size"*;
- `padding` defaults to `10` px and is documented as covering *"extra elements … or margins
  between items that are difficult to measure in JavaScript."*

Three shipped hacks in a ~40-line loop, from a first-party vendor team, for the *easy* case
(one axis, one container, homogeneous items). Our prototype's ~35 lines solve a harder
problem across four page types and reported 240/240 clean — which should read as *evidence
about the fixture*, not about the algorithm. The prior art says: this loop has irreducible
edge cases, and every shipped implementation carries a constant it cannot justify.

### 4. "Attention" is three different axes, and merging them into one integer is the failure mode

The consolidated table separates cleanly into **survival order** (toolbars), **interruption
budget** (notifications, `aria-live`) and **emphasis** (Spectrum, Prominence, M3). *No
shipped system implements more than one.* That is not a gap in the market waiting for us; it
is eighteen years of independent teams each deciding that one axis is the amount a human can
hold.

The maintainer's framing — "let agents reason about attention, hierarchy, density, salience,
progressive disclosure" — names all five. An agent choosing among `data-priority`,
`data-emphasis`, `data-collapse`, `data-density` and a salience level for the same element
has *more* degrees of freedom than `class="text-sm px-4"`, not fewer, and no oracle to tell
it which combination is right. The C10 argument is *"~10 roles instead of 10⁴ utility
combinations"*. Five orthogonal ordinal axes is 10³ combinations before you write any CSS.
**The attention axis, if added, must reduce the vocabulary, not extend it** — and the only
mechanism in the prior art that does that is idea #3 above: derive the level from the role
and let the explicit attribute be the exception.

### 5. Straight verdict: hierarchy is NOT machine-checkable. Geometry is. A thin band in between is.

This is the section the acceptance criteria asks for, so it is stated without hedging.

**Not checkable — perceptual salience.** The candidate oracle is deep saliency prediction
(SalGAN, MSI-Net/`alexanderkroner/saliency`, TranSalNet, SaRa). Three disqualifying
properties, from the literature:

- **The ground truth is a distribution, not a verdict.** Interpreting a saliency score
  requires *inter-observer congruency* — the dispersion of gaze between humans viewing the
  same stimulus — because *"a low score of prediction does not systematically indicate poor
  model performance if the dispersion between observers is high"* (Le Meur & Baccino,
  *Behavior Research Methods*, 2012). An oracle whose failing grade is uninterpretable
  without knowing how much humans disagree is not a build gate.
- **The models are not at human level.** *"Despite advances in deep learning and large scale
  annotated data, visual saliency models still fall short in reaching human-level accuracy"*
  (Borji, arXiv:1810.03716, *Saliency Prediction in the Deep Learning Era*).
- **Nobody uses them for UI.** Searching for adoption turns up research repos and a
  2025 *Brain Informatics* paper fine-tuning TranSalNet on 640 web screenshots with
  eye-tracking from 85 participants — and **gender-differentiated** results, i.e. the
  "correct" saliency map depends on who is looking. There is no `axe-core` of attention.
  Compare the numbers this project already uses to decide things: axe-core **67,615,388/wk**;
  saliency models, zero packaged adoption.

Applying our own round-3 ruling (R3: zero-authoring + a conformance regime is what made
axe-core win): a saliency checker has **no regime**, **no interpretable verdict**, and
**no consensus ground truth**. It fails all three of the tests we already used to kill the
authored relational DSL.

**Checkable — a narrow, genuinely useful band.** These are *set and ordering predicates over
declarations plus rendered geometry*. They are decidable, cheap, and every one of them
derives from the declaration with no author:

| assertable invariant | why it is decidable |
|---|---|
| **Priority monotonicity**: for every degraded container, no surviving element has a lower declared priority than a degraded one | pure comparison over the declaration + the solver's own output; no perception |
| **Pinned survival**: an element declared `pinned`/highest is never collapsed, truncated or hidden at any tested width | the 240-cell matrix already produces the evidence |
| **Reachability after collapse**: everything removed from the flow is reachable via a painted, focusable trigger | our `afford` path already does exactly this — generalise it to `collapse="hide"`, which currently has no such guarantee |
| **Emphasis cardinality**: at most one top-emphasis element per surface; at most one `aria-live="assertive"` region per document | counting over declarations; the ARIA one is an existing a11y rule |
| **Declared-vs-rendered order agreement**: declared reading/priority order matches rendered geometric order (top-to-bottom, then inline-start-to-end) | two orderings compared; this is `reading-flow`'s own semantics applied as an assertion |
| **Disclosure depth**: no more than two levels of progressive disclosure between a leaf and the surface | tree depth over `data-collapse` groups; NN/g's *"designs that go beyond 2 disclosure levels typically have low usability"* is the threshold |
| **Unstated-importance diagnostic**: a container that degrades where no child declared relative importance | requires the "not stated" sentinel (idea #5); otherwise undetectable |

Every one of those is an **order/cardinality/reachability** claim. None is a claim about
*whether the hierarchy is good*. The honest formulation for a README is:
**"the framework checks that the rendered result agrees with the declared hierarchy — it
cannot check that the declared hierarchy is right."** That is a real, defensible,
zero-authoring guarantee and it is strictly weaker than what "machine-checkable attention"
implies. Say the weaker thing.

### 6. `reading-flow` is not our ally, and citing it as one will be caught

The task brief calls `reading-flow` *"the single most aligned standards-track feature for our
attention thesis"*. The spec says the opposite in one sentence: *"The `reading-flow` property
affects neither layout nor painting order and therefore has no effect on rendering to the
visual canvas."* It reorders AT and sequential-navigation traversal only. Its own design note
further instructs that *"the source document should express the underlying logical order of
elements"* — i.e. the CSSWG's position is that reordering should be the exception, used when
layout genuinely produces multiple valid reading orders.

Borrow the grammar (§Ideas #2). Do not claim the alignment.

### 7. The author's priority declaration is an unvalidated guess, and NN/g says so

NN/g's method for deciding what goes in the first disclosure level is **task analysis, field
studies, frequency-of-use statistics and instrumented usage data** — *"you must supplement
such analytics with observational usability testing to discern whether a page gets many hits
because users *want* it or because they simply enter the page by *mistake*."*

`data-priority` replaces all of that with one integer typed by whoever wrote the component —
in our target case, an LLM that has never watched a user. The framework will faithfully
degrade the *declared* least-important element, and will have no way to know the declaration
was wrong. This does not invalidate the mechanism (toolbars have shipped on author-declared
priority for two decades), but it does bound the claim: **`data-priority` moves the
eyes-decision from "which pixel" to "which matters least", and the second decision is not
mechanically checkable either.** The bet is that the second question is easier for an agent
to answer well. That is a hypothesis, and this slice found no evidence for it.

### 8. Collapsing is a UX cost, and no shipped system lets the engine decide it silently

Two first-party warnings, both aimed straight at an automatic fit solver:

- WinUI: *"Although the Minimal and Hidden modes are useful in some situations, keep in mind
  that hiding all actions could confuse users."*
- MDN/ARIA: *"Because an interruption may disorient users or cause them to not complete
  their current task, don't use the `assertive` value unless the interruption is imperative."*

And a structural point: **`minimumVisible` exists in Fluent's options for exactly this
reason** (*"Minimum number of items that must remain visible"*), and it is an author
declaration, not a derived value. Our solver's terminal state is `unsatisfiable`; Fluent's is
"stop at `minimumVisible` and let it overflow". Those are different philosophies and the
shipped one refuses to degrade past an author-declared floor. Our F9 finding (the resolution
table can state an impossible constraint) plus this suggests the missing primitive is
**a declared floor on degradation**, not a better solver.

### 9. Nobody has ever shipped page-level attention budgeting, and the silence is data

Every priority system in this survey is scoped to **one container**: a toolbar, a command
bar, a ribbon tab, an `Overflow` provider. Attention, as the maintainer frames it, is a
*page-level* scarce resource — you cannot decide that this panel deserves the reader's eye
more than that one by looking at either panel alone. There is no prior art for that. In a
survey covering Apple, Microsoft (twice), Google, Adobe, GNOME, GitHub and the W3C, the
absence of any cross-container attention budget over ~18 years is more likely to be evidence
of difficulty than of an untaken opportunity. Treat "global attention allocation" as an
unexplored research direction, not as a feature with a known shape.

---

## Open questions for the maintainer

1. **Is the interruption axis in scope at all?** Android/iOS/`aria-live` are a coherent,
   shipped, three-to-six-level vocabulary — and they describe *notifications*, a domain
   `@nisli/next` may not be in. *Tradeoff:* adopting it gives the "attention" framing real
   teeth and a standards lineage; declining it keeps the vocabulary at ~12 attributes and
   avoids §Wrong #4's combinatorial blow-up. **These cannot both be had.**

2. **Integer or bounded ordinal?** `DynamicOverflowOrder` and Fluent use `int`; AppKit and
   Android use a small named ordinal with a reserved top. *Tradeoff:* an `int` composes
   across independently-generated components with no coordination but is unbounded and
   unvalidatable (every agent writes `9999`); a 4-level ordinal is enumerable, closed,
   checkable and fits the "whole vocabulary on one page" constraint, but forces collisions
   the author must then break by DOM order. Only a human can decide whether collisions are
   a bug or the point.

3. **Should the level be derived from the role by default?** ARIA proves it works
   (`role="alert"` ⇒ `assertive`). *Tradeoff:* derivation makes the common case zero
   attributes and every explicit `data-priority` a reviewable exception — but it hard-codes a
   taste judgement ("a danger action always outranks a quiet action") into the resolution
   table, and §5.4 already says the table is the part we cannot delegate.

4. **Does `collapse="hide"` ever get to destroy reachability?** Every shipped system
   preserves access when it degrades (overflow menu, below-the-fold shade,
   `hidden="until-found"`). *Tradeoff:* keeping `hide` gives the solver a cheap last resort
   for things like timestamps that genuinely have no menu representation; removing it makes
   "everything declared is reachable at every width" an unconditional, checkable framework
   guarantee. Alternatively `hide` could be *defined* as `hidden="until-found"` for text —
   which keeps a box and therefore changes the fit arithmetic.

5. **Who owns the level — the author, the context, or the user?** Android's channel model
   gives the *user* the final say and the app only chooses a channel. *Tradeoff:* a
   user/context override slot is the principled answer to §7.20 art direction and to
   accessibility (reduced-motion-style preferences for density), but it introduces a second
   writer to a value the exclusivity argument (§2) says must have exactly one.

6. **Do we cap disclosure depth at two?** NN/g: *"designs that go beyond 2 disclosure levels
   typically have low usability."* *Tradeoff:* enforcing it as a diagnostic is free and
   defensible; enforcing it as a hard limit forbids legitimately deep surfaces (a nested
   settings tree) and pushes them straight to the escape hatch.

7. **Is SSR "assume nothing overflows" (Primer) acceptable, or must the static tier
   pre-solve?** *Tradeoff:* Primer's one-liner is shipped, free, and makes first paint a
   known state; pre-solving at SSG time is the stronger story but needs a width the build
   does not have, and the flash-of-unfit risk is still unquantified in our own prototype.

8. **Is `data-priority` load-bearing at all, or is DOM order enough?** §Wrong #2. *Tradeoff:*
   deleting it removes a vocabulary entry, a whole class of agent inconsistency, and the
   tie-break bug — at the cost of the case where reading order and importance genuinely
   diverge (a destructive action written last but that must never be hidden). Note that
   `pinned` alone may cover that case without any ordinal at all.

9. **What do we call the guarantee?** §Wrong #5 says the honest phrasing is *"the framework
   checks that the rendered result agrees with the declared hierarchy"*, not *"the framework
   checks the hierarchy"*. The weaker claim is defensible and derived-with-no-author; the
   stronger one is what makes a README travel. This is a positioning decision, not an
   engineering one.

---

## Belongs to another slice

- **Container queries / `AdwBreakpoint` as the general "responsive without breakpoints"
  mechanism** — I only touched libadwaita's declarative `<condition>`/`<setter>` shape
  because it is the closest non-CSS analogue to declared adaptation. The comparison of
  container queries vs. breakpoints vs. `AdwBreakpoint` belongs to whoever owns the
  constraint/adaptive-layout slice.
- **`popover`, `command`/`commandfor`, and the Invoker Commands API as *interaction*
  primitives** — I cite `interestfor` only for its attention-threshold semantics
  (`interest-delay-start/end`). The invoker/popover family as a general declarative
  interaction vocabulary is a different slice.
- **`axe-core`'s geometry predicates** (`hasVisualOverlap`, `getLargestUnobscuredArea`,
  `splitRects`) — already ruled on in `ROUND2-EVIDENCE-visual-oracle-prior-art.md` R3; I
  reuse only its adoption number as a calibration point.
- **Density scales in Carbon / M3 / Spectrum** — the brief lists these under progressive
  disclosure, but density is a *resolution-table* concern (our `--unit`), and the theme /
  resolution-table slice owns it.

---

## Sources

### Primary — API references and specifications

- Android `NotificationManager` (all `IMPORTANCE_*` and `INTERRUPTION_FILTER_*` constants and values) — <https://developer.android.com/reference/android/app/NotificationManager>
- Apple `UNNotificationInterruptionLevel` — <https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel>
- Apple `NSToolbarItem.VisibilityPriority` (struct overview + `.low` discussion) — <https://developer.apple.com/documentation/appkit/nstoolbaritem/visibilitypriority-swift.struct> · <https://developer.apple.com/documentation/appkit/nstoolbaritem/visibilitypriority-swift.struct/low>
- SwiftUI `Prominence` — <https://developer.apple.com/documentation/swiftui/prominence>
- WAI-ARIA 1.3 Editor's Draft, 20 August 2026 (`alert` ⇒ implicit `assertive`; `log` ⇒ implicit `polite`) — <https://w3c.github.io/aria/#aria-live>
- MDN `aria-live` (verbatim value definitions and the `assertive` warning) — <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live>
- CSS Display Module Level 4, ED 5 June 2026 — §4 Reading Order (`reading-flow`), §4.1 (`reading-order`), §5 `visibility` incl. `force-hidden` — <https://drafts.csswg.org/css-display-4/#reading-flow>
- MDN `content-visibility` — <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility>
- MDN `hidden` global attribute (incl. `until-found` / `beforematch` / `content-visibility: hidden` implementation note) — <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden>
- MDN `text-wrap-style` (`auto|balance|pretty|stable`, line-count limits) — <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap-style>
- Open UI — Interest Invokers Explainer, last updated 2026-08-18 (WHATWG PR #11006; `interest-delay-start/end` default `0.5s`; `:interest-source`; `::interest-button`) — <https://open-ui.org/components/interest-invokers.explainer/>

### Primary — Microsoft platform documentation

- `ICommandBarElement.DynamicOverflowOrder` (Windows App SDK 0.8 → 2.0) — <https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.icommandbarelement.dynamicoverfloworder>
- Command bar conceptual doc (`PrimaryCommands`/`SecondaryCommands`, `IsDynamicOverflowEnabled`, `ClosedDisplayMode`, "add commands in order of their importance", 320 epx / 4 commands) — <https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/command-bar>
- Ribbon `ScalingPolicy` element (descending-size rule; 300px/96dpi recommendation) — <https://learn.microsoft.com/en-us/windows/win32/windowsribbon/windowsribbon-element-scalingpolicy>
- Ribbon `Scale` element (`Large|Medium|Small|Popup`) — <https://learn.microsoft.com/en-us/windows/win32/windowsribbon/windowsribbon-element-scale>
- "Customizing a Ribbon Through Size Definitions and Scaling Policies" (template catalogue; "intended for prototyping purposes only"; compilation-terminating validation error) — <https://learn.microsoft.com/en-us/windows/win32/windowsribbon/windowsribbon-templates>

### Primary — package source read locally

- `@fluentui/priority-overflow@9.4.3` (npm tarball) — `package/lib/overflowManager.js:52-73` (`compareItems`), `:154-186` (`processOverflowItems`), `package/dist/index.d.ts` (`OverflowOptions.padding` default `10`, `OverflowGroupState`, `OverflowItemEntry.pinned`, `minimumVisible`, `OverflowDirection`, `OverflowAxis`)
- `microsoft/fluentui` `packages/react-components/react-overflow/library/src/components/OverflowItem/OverflowItem.types.ts` (the `pinned` XOR `priority` union) — <https://raw.githubusercontent.com/microsoft/fluentui/master/packages/react-components/react-overflow/library/src/components/OverflowItem/OverflowItem.types.ts>
- `@primer/react@38.36.0` (npm tarball) — `package/dist/ActionBar/ActionBar.d.ts` (`ActionBarProps` — no priority prop), `package/dist/internal/hooks/useOverflowObserver.js` (`useIsClipped`, `getOverflowServerSnapshot = () => false`), `package/dist/ActionBar/ActionBar.js:18,65,80` (`data-overflowing`, `data-has-overflow`)
- `@spectrum-web-components/button@1.12.2` (npm tarball) — `package/src/Button.d.ts:19-44` (`ButtonVariants`, `ButtonTreatments`, `ButtonStaticColors`, deprecations), `package/src/Button.dev.js:38-104` (defaults `accent`/`fill`; `cta`/`overBackground`/`white`/`black` deprecation paths)
- `material-components/material-web` `docs/components/button.md` (five button types; elevated-button guidance; freshness reviewed 2026-07-31) — <https://raw.githubusercontent.com/material-components/material-web/main/docs/components/button.md>

### Primary — KDE

- Kirigami `DisplayHint` enumeration and its doc comment (`NoPreference=0`, `IconOnly=1`, `KeepVisible=2`, `AlwaysHide=4`, `HideChildIndicator=8`; mutual exclusivity with `KeepVisible` precedence; `displayHintSet()` helper, `@since 2.14`) — <https://raw.githubusercontent.com/KDE/kirigami/master/src/layouts/displayhint.h>
- Kirigami `ActionToolBar.qml` (default overflow behaviour; `KeepVisible` ⇒ degrade to icon-only; the overflow button's own `displayHint: IconOnly | HideChildIndicator`; `overflowIconName` default `overflow-menu`, `@since 5.65`) — <https://raw.githubusercontent.com/KDE/kirigami/master/src/controls/ActionToolBar.qml>

### Primary — GNOME

- `AdwBreakpoint` (condition + setters, GtkBuildable XML form, since libadwaita 1.4) — <https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.Breakpoint.html>

### Primary — research and guidance

- Jakob Nielsen, "Progressive Disclosure", NN/g, 2006-12-03 (two-level rule; "the very fact that something appears on the initial display tells users that it's important"; the >2-levels ceiling; frequency-of-use statistics) — <https://www.nngroup.com/articles/progressive-disclosure/>
- A. Borji, "Saliency Prediction in the Deep Learning Era: Successes, Limitations, and Future Challenges", arXiv:1810.03716 — <https://arxiv.org/abs/1810.03716>
- Le Meur & Baccino, "Methods for comparing scanpaths and saliency maps: strengths and weaknesses", *Behavior Research Methods* (2012) — inter-observer congruency and the uninterpretability of an absolute score — <https://link.springer.com/article/10.3758/s13428-012-0226-9>
- Gender-aware saliency prediction for web interfaces (WIC640: 640 web screenshots, eye-tracking from 85 participants; TranSalNet fine-tuning), *Brain Informatics*, 2025-10-02 — <https://braininformatics.springeropen.com/articles/10.1186/s40708-025-00274-x>
- Saliency model implementations surveyed for adoption: `alexanderkroner/saliency` (MSI-Net), `imatge-upc/salgan`, `LJOVO/TranSalNet` — <https://github.com/topics/saliency-prediction>

### Adoption figures

All npm figures from the npm registry downloads point API, `last-week`, fetched 2026-08-25:
`@fluentui/react-components` 394,167 · `@fluentui/priority-overflow` 390,162 ·
`@fluentui/react-overflow` 377,315 · `@material/web` 134,690 · `@vaadin/menu-bar` 70,017 ·
`axe-core` 67,615,388 · `@github/details-menu-element` 63,639 · `@primer/react` 57,345 ·
`@spectrum-web-components/action-bar` 14,880 · `galen-framework` — not published on npm
(consistent with `ROUND2-EVIDENCE-visual-oracle-prior-art.md` R2).

### In-repo cross-references

- `docs/worklists/nextgen/NEXTGEN-SCRATCHPAD.md` §4 C10/C11, §5.4 (weighting), §5.2 R3 (zero-authoring + regime), §7.17–7.20
- `docs/worklists/nextgen/C11-EXCLUSIVITY-AND-DERIVATION.md` §2 (exclusivity), §2.3 (escape ratio as a countable metric)
- `experiments/c11-appearance/README.md` — F9 (the table can state an impossible constraint), F10 (a solver must measure the world it creates), F11 (priority orders *when* a strategy is spent, never *whether*), and the round-5 group/tie-break corrections
