# 0021 — `each()` is the only template consumer that rejects factory results

**Status**: open
**Priority**: P1
**Area**: `@nisli/core` — template engine
**Found**: 2026-08-25, while building `experiments/c11-appearance` (an agent
authoring a list of components hit it and lost the whole page).

## Summary

`component()` returns a `ComponentFactory<P>` whose declared return type is
`TemplateResult` (`component.ts:132-135`), but the value it actually produces is
a factory descriptor — `{ __type: 'factory', tagName, props, hostAttrs }`
(`component.ts:788-793`). Every other consumer in the template engine handles
both shapes; `each()` handles only one:

| consumer | handles `__templateResult` | handles `__type: 'factory'` |
|---|---|---|
| text/child slot | yes (`template.ts:766`) | yes (`template.ts:767`) |
| array in a slot | yes (`template.ts:784`) | yes (`template.ts:785`) |
| reactive slot swap | yes | yes (`template.ts:664-666`, `709-711`) |
| projection | yes | yes (`projection.ts:80-81`) |
| **`each()`** | **yes** (`template.ts:1288-1289`) | **no** |

`each()` does:

```ts
const templateResult = templateFn(itemSignal, indexSignal);
templateResult.mount(wrapper);
```

A factory descriptor has no `mount`, so the call fails inside `reconcile()`,
which runs inside the `effect()` installed by `each().mount()`. Effect failures
are contained by design (`error-effect-survives`), so the list renders as
markers with no items, the component is NOT stamped `data-nisli-error`, and no
boundary event fires. The type checker cannot help: the callback's declared
return type is exactly what the factory claims to return.

## Reproduction

```ts
// renders comment markers and nothing else
each(items, (item) => item.id, (item) => Avatar({ initials: computed(() => item.value.initials) }))

// renders correctly
each(items, (item) => item.id, (item) => html`${Avatar({ initials: computed(() => item.value.initials) })}`)
```

Observed in `experiments/c11-appearance/src/app/pages/inbox.ts`, isolated against
core directly, and worked around there with a load-bearing comment.

## Why it matters

1. **Silent.** An empty list is the "Potemkin interface" failure class this repo
   has already paid for five times (`docs/worklists/nextgen/ROUND2-EVIDENCE-defect-corpus.md`
   rank 2): rendering as inert nothing, with no diagnostic.
2. **The natural spelling is the broken one.** `each(rows, key, (row) => Row({ ... }))`
   is what an author — human or agent — writes first, because factory
   composition is the documented way to compose components
   (`comp-factory-composition`), and because it works in every other slot.
3. **The type system endorses it.** `ComponentFactory` says `TemplateResult`, so
   the wrong call typechecks. The gap between the declared and actual return
   type is the root cause; `each()` is where it becomes visible.

## Options

1. **Accept factory results in `each()`** — reuse `mountFactoryResult()`
   (already used at `template.ts:710`, `769`, `786`) behind the same shape test.
   Smallest fix, makes the natural spelling correct, and closes the
   inconsistency in the table above. Requires an entry disposer per factory,
   which `mountFactoryResult` already returns.
2. **Make the type honest** — give `ComponentFactory` a distinct return type
   (e.g. `FactoryResult`) that the template slots accept in a union with
   `TemplateResult`, so `each()`'s narrower signature becomes a compile error at
   the callsite instead of a silent runtime no-op. Larger, breaking for anyone
   who annotates the return type, but it removes the class rather than this
   instance.
3. **Both** — 1 for behaviour, 2 for the contract. Preferred if the breaking
   surface of 2 is as small as it looks (the type is exported, but callers
   normally infer it).

Not an option: documenting the workaround. A silent empty render is the failure
mode ADR 0030.1 B1 ("make silence loud") exists to delete.

## Notes

Related: `each()` already validates its key set eagerly and refuses to reconcile
on duplicates (issue 0014), which is the same instinct applied to the other
input. This is the callback's turn.
