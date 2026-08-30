# Ledger — tenets

Ledger is Goga's personal finance system: one person, real accounts, real
money, used to see everything and decide responsibly. These tenets are the
rules every change is measured against. They are not aspirations; a change
that breaks one is wrong even if it works.

Recorded 2026-08-29 from Goga's own statements; keep this file in sync with
the ADRs it references and update it when a tenet changes — say why.

## 0. Small scope, truly good

Ledger does few things and does them excellently. A capability is added only
when it makes the daily use better for its one user, and it ships finished:
correct, fast, proven, explained. "It would be nice to have" is a reason to
say no. When in doubt, sharpen what exists rather than add.

## 1. It is not a toy

Every runtime feature is built to be used daily with real data. Ledger has no
demo dataset, sample bank, or credential-free fallback. Test doubles exist
only inside automated tests and can never be selected by runtime configuration.
Missing provider configuration is a startup failure, never invented money.

## 2. Local-first, owner-hosted

- The system of record runs on Goga's Mac. No third-party cloud holds the
  ledger.
- The browser is a client. It may cache, it never owns the data. (Today's
  `localStorage` store is a stopgap and is scheduled to move behind the
  server; nothing new is built on it.)
- Remote access is only over a private, end-to-end-encrypted network
  (Tailscale or equivalent peer-to-peer overlay). The server binds to
  localhost and the tailnet interface only; it is never exposed to the public
  internet, and it never needs to be for the bank link to work.

## 3. Nothing is lost

- Every write is durable before it is acknowledged.
- Automatic, dated backups; restore is a first-class, tested path.
- Imported bank data is never silently altered: corrections are new facts
  layered on the original (rules re-file, they do not rewrite history).
- Deletions ask first and say what they delete.

## 4. Credentials never pass through Ledger

- Bank logins are entered only in the provider's own OAuth/Link window —
  never in a Ledger form, never seen by the Ledger server, never by an agent.
- Provider access tokens live only on the server, encrypted at rest, and are
  never sent to the browser.
- Secrets are configuration (env), never code, never git.

## 5. Full visibility, explained

- Every number on screen can be traced to the transactions behind it.
- Every automatic decision — a category from a rule, a reconciled opening
  balance, a de-duplicated import — is visible and reversible.
- Insight features (safe-to-spend, forecasts, alerts) show their arithmetic.
  A recommendation the user cannot check is not a recommendation.

## 6. Money is exact

Amounts are integer minor units (cents). Currency is explicit per account.
Display formatting is the only place a decimal appears.

## 7. Provider-independent

Bank connectivity sits behind one adapter contract (link → accounts →
sync-with-cursor → remove). Switching Plaid ↔ SimpleFIN ↔ Teller ↔ CSV is a
configuration change, not a rewrite. CSV import remains a supported path
forever; it is the fallback that no vendor can take away.

## 8. Private by construction

No analytics, no telemetry, no third-party scripts except the provider's own
link widget, loaded only when linking. Logs never contain amounts, payees or
tokens.

## 9. Built on the engine, and the engine learns from it

Ledger is the first real application of `@nisli/engine`: it states intent,
never appearance. When Ledger needs something the engine cannot express, the
gap is recorded (`docs/issues/`) and solved in the engine — never worked
around with app-side styling. See ADR 0034 and 0035.

## 10. Verified before believed

A feature ships with its proof: width tests for layout, an end-to-end run for
every money-moving flow (import, sync, edit, delete, restore), and zero
console errors across all routes at five widths. Screenshots are for looking,
not for correctness.

## 11. Intelligence without a chat box

Ledger is agent-friendly and AI-assisted, and it has no chat interface. The
intelligence is ambient: a transaction already filed, a subscription already
noticed, a "safe to spend" already computed, an alert already raised — each
shown in place, with its reasoning one tap away (tenet 5), reversible (tenet
3). Nothing asks the user to type a prompt, and nothing pretends to converse.
The same discipline that keeps the UI free of visual decisions keeps it free
of conversational ones: agents act through the app's typed intents and the
engine's blocks, never through a text box.

## 12. Intent is captured visually

The app learns what the user wants through the interface itself — a tap on
a row, a budget dragged to a new limit, a category chosen, a bill marked
recurring, a transaction split — never through a text box asking what they
meant. Every intent has a visual control and a visible result; text fields
exist for data (a payee, a note, an amount), not for instructions. What the
user does in the UI *is* the instruction, and the intelligence (tenet 11)
reads it from there.

## 13. Deterministic UI

The same viewport and the same intent always produce the same structure.
Data fits into the structure; it never reshapes it. Sorting, filtering or
paging must never make a column, an action or a section appear or disappear.
Goga, 2026-08-30, after a sort by Amount folded two columns of the
Transactions table: "even if the engine is smart, the UI must be
deterministic and behave as it is supposed to." See ADR 0044 and issue 0028.
