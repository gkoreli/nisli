# experiments/

Throwaway prototypes for open strategy questions. **Nothing here ships.**

- **Not in `packages/`.** That directory means "shippable, versioned, published
  or the site". Experiments never go there.
- **Workspace members, but gate-neutral.** `experiments/*` is in
  `pnpm-workspace.yaml` so a prototype can link `@nisli/core` and install its
  own tooling instead of borrowing another package's binaries. An experiment
  defines **only** a `dev`-style script: `pnpm -r <script>` skips packages that
  do not define that script, so `pnpm build`, `pnpm test` and `pnpm typecheck`
  never see this directory.
- **No package imports from here, ever.** Dependencies point one way:
  experiments may depend on `packages/*`; `packages/*` must never reference
  `experiments/*`.
- **Deletable wholesale.** Removing this directory must never break a gate, a
  build, or a published package.
- **Findings graduate, code does not.** What an experiment proves belongs in
  `docs/worklists/<area>` or an ADR. The prototype itself stays disposable.
- **One cost, stated:** adding an experiment changes `pnpm-lock.yaml`, so other
  worktrees must run `pnpm install` after rebasing past it — the trap named in
  the root `AGENTS.md`.

## Current experiments

| Directory | Question it exists to answer | Parent record |
|---|---|---|
| [`c11-appearance/`](./c11-appearance/) | Can appearance be *derived* from declared meaning and context — with zero pixel values and zero breakpoints in component source — for components the framework has never seen? | [`docs/worklists/nextgen/`](../docs/worklists/nextgen/) |
