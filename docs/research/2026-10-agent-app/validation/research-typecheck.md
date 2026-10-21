# Research TypeScript validation

```sh
pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck --lib esnext,dom,dom.iterable docs/research/2026-10-agent-app/experiments/operation-coordinator/coordinator.ts docs/research/2026-10-agent-app/experiments/operation-coordinator/probe.test.ts docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts
```

Exit status: **0**. Full output: empty (no diagnostics).

An initial command omitted dom.iterable and found fixture callbacks typed too broadly. The final command includes the required DOM library; generic fixture return types now match their returned values. No production source or behavioral assertions changed.
