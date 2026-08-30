# Ledger Research Program

This table is the implementation ledger for research decisions in this
directory. Research conclusions stay in their dated reports; durable design
decisions move to ADRs.

| Work | Status | Evidence / next boundary |
|---|---|---|
| [Bank-data provider selection](./bank-data-providers-2026-08-29.md) | Decision taken | Plaid Trial primary; SimpleFIN parallel adapter; CSV/QFX fallback. |
| Plaid production connection | Implemented | Provider adapter, encrypted connection aggregate, OAuth/update Link, historical sync, daily retry, disconnect, and live-only projection are recorded in [ADR 0039](../../adr/0039-ledger-bank-connectivity-domain.md). |
| Provider-independent bank domain | Implemented | Normalized signed minor units, opaque checkpoints, provenance, owner-write boundary, lifecycle/history, and safe rebuilds in ADR 0039. Runtime uses real providers only; doubles stay in tests. |
| CSV fallback | Implemented | Existing browser CSV import remains owner-managed and provider-independent. |
| SimpleFIN Bridge adapter | Not started | Add behind the normalized provider port; do not leak SimpleFIN windows or signs into Ledger. |
| QFX import | Not started | Extend the file-import boundary without changing the bank-connection aggregate. |
