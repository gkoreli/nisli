# UI-30 worklist

This is the batch plan for migrating `packages/ui/registry/default/ui` off the userland surface:

- `attr()` / `boolAttr()` / `forwardedAttr()` become `component(..., { attrs: ... })`
- `captureChildren()` / `projectChildren()` / `props.children` interpolation become `children()`

Scope check on `packages/ui/registry/default/ui/**/*.ts` excluding tests:

- 58 component files scanned
- 58/58 files contain at least one helper site
- helper sites found: 374 `attr()`, 67 `boolAttr()`, 20 `forwardedAttr()`, 194 `captureChildren()`, 191 `projectChildren()`

Batch order:

1. forward-mix form controls
2. heavy string-attr menus
3. tail

Already migrated / intentionally excluded from UI-30:

- `button`
- `switch`
- `message-scroller`

## Batch 1 — forward-mix form controls

| Component | Attrs to migrate | Projection | Special notes | Batch |
| --- | --- | --- | --- | --- |
| `checkbox` | `value` via `attr`; `checked`, `disabled`, `required` via `boolAttr`; `id`, `name` via `forwardedAttr` | — | form control | 1 |
| `input` | `type`, `placeholder`, `autocomplete`, `value` via `attr`; `id`, `name` via `forwardedAttr`; `disabled`, `required`, `readOnly` via `boolAttr` | — | form control | 1 |
| `input-group` | `align`, `className`, `type`, `variant`, `size`, `placeholder`, `autocomplete`, `value` via `attr`; `id`, `name` via `forwardedAttr`; `disabled`, `required`, `readOnly` via `boolAttr` | `captureChildren×5`, `projectChildren×4` | multi-part form family | 1 |
| `input-otp` | `inputMode`, `value`, `defaultValue`, `id`, `name`, `disabled`, `className`, `containerClassName` via current helpers | — | form control; forwarded host identity | 1 |
| `radio-group` | `value`, `defaultValue`, `name`, `id`, `disabled`, `className` via current helpers | `captureChildren×1`, `projectChildren×1` | form control | 1 |
| `select` | `value`, `defaultValue`, `size`, `id`, `name`, `disabled`, `required`, `className` via current helpers | `captureChildren×1`, `projectChildren×1` | form control | 1 |
| `slider` | `id`, `name` via `forwardedAttr`; `disabled` via `boolAttr`; `className` via `attr` | — | form control | 1 |
| `textarea` | `placeholder`, `autocomplete`, `value`, `id`, `name`, `disabled`, `required`, `readOnly`, `className` via current helpers | `captureChildren×1` | form control | 1 |

## Batch 2 — heavy string-attr menus

| Component | Attrs to migrate | Projection | Special notes | Batch |
| --- | --- | --- | --- | --- |
| `context-menu` | `align`, `side`, `variant`, `value`, `className` via `attr`; `disabled`, `inset` via `boolAttr` | `captureChildren×13`, `projectChildren×13` | menu family; portal / overlay interactions | 2 |
| `dropdown-menu` | `align`, `side`, `variant`, `value`, `className` via `attr`; `disabled`, `inset` via `boolAttr` | `captureChildren×13`, `projectChildren×13` | menu family; portal / overlay interactions | 2 |
| `menubar` | `align`, `variant`, `value`, `className` via `attr`; `disabled`, `inset` via `boolAttr` | `captureChildren×14`, `projectChildren×14` | menu family; portal / overlay interactions | 2 |
| `sidebar` | `side`, `variant`, `collapsible`, `type`, `placeholder`, `width`, `href`, `size`, `className` via current helpers; `isActive`, `showIcon`, `showOnHover` via `boolAttr` | `captureChildren×14`, `projectChildren×14` | multi-part family; portal interactions; defaults observed in source: `side='left'`, `variant='sidebar'`, `collapsible='offcanvas'` | 2 |

## Batch 3 — tail

| Component | Attrs to migrate | Projection | Special notes | Batch |
| --- | --- | --- | --- | --- |
| `accordion` | `type`, `collapsible`, `defaultValue`, `className`, `value`, `disabled` via current helpers | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `alert` | `variant`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `alert-dialog` | `className`, `size`, `variant` via current helpers | `captureChildren×8`, `projectChildren×8` | tail | 3 |
| `aspect-ratio` | `className` via `attr` | `captureChildren×1`, `projectChildren×1` | native-first translation; keep box contract (`relative w-full`) when porting | 3 |
| `attachment` | `state`, `size`, `orientation`, `variant`, `type`, `ariaLabel`, `className` via current helpers; `disabled` via `boolAttr` | `captureChildren×9`, `projectChildren×9` | tail | 3 |
| `avatar` | `size`, `className`, `src`, `alt` via current helpers | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `badge` | `variant`, `className` via current helpers | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `breadcrumb` | `href`, `className` via current helpers | `captureChildren×6`, `projectChildren×6` | tail | 3 |
| `bubble` | `variant`, `align`, `side`, `className` via current helpers | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `button-group` | `orientation`, `className` via current helpers | `captureChildren×2`, `projectChildren×2` | already in the tail batch even though `button` itself is excluded | 3 |
| `calendar` | `mode`, `locale`, `className` via current helpers; `showOutsideDays` via `boolAttr` | — | default observed in source: `showOutsideDays=true` | 3 |
| `card` | `className` via `attr` | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `carousel` | `orientation`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `collapsible` | `disabled`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `command` | `placeholder`, `heading`, `keywords`, `value`, `className` via current helpers; `disabled` via `boolAttr` | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `combobox` | `placeholder`, `searchPlaceholder`, `emptyText`, `value`, `keywords`, `className` via current helpers; `disabled` via `boolAttr` | — | tail | 3 |
| `dialog` | `className` via `attr` | `captureChildren×7`, `projectChildren×7` | tail | 3 |
| `direction` | `dir`, `direction` via current helpers | `captureChildren×1`, `projectChildren×1` | host-state / RTL-LTR provider | 3 |
| `drawer` | `direction`, `className` via current helpers | `captureChildren×7`, `projectChildren×7` | tail | 3 |
| `empty` | `variant`, `className` via current helpers | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `form-field` | `orientation`, `className` via current helpers; `invalid` via `boolAttr` | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `hover-card` | `side`, `align`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `item` | `size`, `variant`, `className` via current helpers | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `kbd` | `className` via `attr` | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `label` | `htmlFor`, `className` via current helpers | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `marker` | `variant`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |
| `message` | `align`, `className` via current helpers | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `navigation-menu` | `href`, `value`, `className` via current helpers | `captureChildren×6`, `projectChildren×6` | tail | 3 |
| `pagination` | `href`, `size`, `className` via current helpers; `isActive` via `boolAttr` | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `popover` | `side`, `align`, `className` via current helpers | `captureChildren×5`, `projectChildren×5` | tail | 3 |
| `progress` | `className` via `attr` | — | tail | 3 |
| `resizable` | `direction`, `className` via current helpers | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `scroll-area` | `className` via `attr` | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `separator` | `orientation`, `className` via current helpers; `decorative` via `boolAttr` | — | default observed in source: `decorative=true` | 3 |
| `sheet` | `side`, `className` via current helpers | `captureChildren×7`, `projectChildren×7` | tail | 3 |
| `skeleton` | `className` via `attr` | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `table` | `className` via `attr` | `captureChildren×2`, `projectChildren×2` | add `colSpan` (+`rowSpan`?) passthrough on `TableCell` / `TableHead`; upstream `table.tsx` spreads props onto `td` / `th`; eng3 needs `colSpan=3` in the www footer total | 3 |
| `tabs` | `value`, `defaultValue`, `orientation`, `variant`, `className` via current helpers; `disabled` via `boolAttr` | `captureChildren×4`, `projectChildren×4` | tail | 3 |
| `toast` | `position`, `className` via current helpers | — | tail | 3 |
| `toggle-group` | `type`, `variant`, `size`, `value`, `className` via current helpers; `disabled` via `boolAttr` | `captureChildren×2`, `projectChildren×2` | tail | 3 |
| `toggle` | `variant`, `size`, `className` via current helpers; `disabled`, `defaultPressed` via `boolAttr` | `captureChildren×1`, `projectChildren×1` | tail | 3 |
| `tooltip` | `side`, `className` via current helpers | `captureChildren×3`, `projectChildren×3` | tail | 3 |

## Direct attr sites in the remaining UI-30 scope

Scan basis: raw `host.getAttribute()` / `host.hasAttribute()` calls outside the
helper layer, excluding the 11 components already in flight (`batch 1` plus
`switch` / `button` / `message-scroller`).

| Component | Direct attr sites | Semantics | Notes |
| --- | --- | --- | --- |
| `alert-dialog` | `open`, `default-open`, `portal` | booleans; `portal` defaults true when absent / anything except `"false"` | root open state + portaled content |
| `aspect-ratio` | `ratio` | number; defaults to `1` | parse guarded with `Number.isFinite` |
| `calendar` | `month`, `default-month`, `min`, `max`, `week-starts-on` | ISO date strings parsed to `Date`; `week-starts-on` is a number defaulting to `0` | local fallback parsing, not helper-based |
| `collapsible` | `open`, `default-open` | booleans | root open state fallback |
| `combobox` | `multiple`, `value`, `default-value` | `multiple` is boolean; `value` / `default-value` are strings (comma-separated when `multiple`) | root selection fallback |
| `context-menu` | `open`, `default-open`, `portal`, `checked`, `default-value` | booleans for `open` / `default-open` / `checked`; `portal` defaults true; `default-value` is a string | menu root + checkbox/radio item fallbacks |
| `dialog` | `open`, `default-open`, `portal` | booleans; `portal` defaults true when absent / anything except `"false"` | root open state + portaled content |
| `drawer` | `open`, `default-open` | booleans | root open state fallback |
| `dropdown-menu` | `open`, `default-open`, `portal`, `checked`, `default-value` | booleans for `open` / `default-open` / `checked`; `portal` defaults true; `default-value` is a string | menu root + checkbox/radio item fallbacks |
| `menubar` | `portal`, `checked`, `default-value`, `default-open` | `portal` defaults true; `checked` is boolean; `default-value` is a string; `default-open` is boolean | menu content + item/submenu fallbacks |
| `navigation-menu` | `active` | boolean | item active-state fallback |
| `popover` | `open`, `default-open`, `portal` | booleans; `portal` defaults true when absent / anything except `"false"` | root open state + portaled content |
| `progress` | `value`, `max` | numbers; `max` defaults to `100` | value is indeterminate when absent |
| `resizable` | `default-size`, `min-size`, `with-handle` | `default-size` / `min-size` are numbers; `with-handle` is boolean | panel defaults + handle chrome |
| `sheet` | `open`, `default-open`, `portal` | booleans; `portal` defaults true when absent / anything except `"false"` | root open state + portaled content |
| `sidebar` | `default-open` | boolean; defaults true when absent, and only `"false"` forces closed | provider bootstrap fallback |
| `toggle-group` | `default-value` | string list encoded as a string / comma-separated string | uncontrolled selection seed |
| `toggle` | `pressed` | boolean | bare attribute seeds the uncontrolled pressed state |
| `tooltip` | `portal` | boolean; defaults true when absent / anything except `"false"` | portaled content fallback |

## Already migrated / excluded from UI-30 planning

| Component | Why it is not on the batch plan | Batch |
| --- | --- | --- |
| `button` | treated as already migrated by steering | excluded |
| `switch` | treated as already migrated by steering | excluded |
| `spinner` | already landed in CDX-1; not scheduled here | excluded |
| `message-scroller` | treated as already migrated by steering | excluded |
