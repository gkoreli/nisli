# 0028. Local Async Derivations with `resource()`

**Date**: 2026-07-16
**Status**: Accepted

## Context

Local async transformations do not fit synchronous `computed()`, but using
`query()` would add shared cache-key and invalidation policy. The backlog-mcp
markdown component therefore hand-rolled `effect() + signal` and had no
stale-result, rejection, or disconnect guard.

## Decision

`@nisli/core` provides:

```ts
resource(
  source: () => S | undefined,
  loader: (source: S, signal: AbortSignal) => PromiseLike<T>,
)
```

It returns readonly `data`, `loading`, and `error` signals plus `refresh()` and
`dispose()`.

- Only `source()` is dependency-tracked.
- `loader()` starts outside the reactive observer.
- Each run owns an `AbortController` and generation; only the newest live
  generation may commit.
- `undefined` disables the resource and clears its state.
- Successful data remains visible while a newer enabled run loads.
- Component setup owns disposal automatically; standalone callers dispose
  explicitly.

## Boundaries

This is not a second query system. It has no cache, key, deduplication,
invalidation, stale time, retry, callbacks, status enum, suspense, SSR promise
collection, or async component setup. Those policies wait for demonstrated
consumer pressure.
