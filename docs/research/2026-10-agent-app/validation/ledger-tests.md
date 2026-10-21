# Unchanged Ledger baseline

```sh
pnpm --filter @nisli/ledger test
```

Exit 0: 190 tests in 17 files; no type errors. These are existing baseline checks, including estimator-based screen proofs, not validation of the unbuilt application layer or a real-browser run.

## Full output

```text

> @nisli/ledger@0.2.0 test /Users/goga/Documents/goga/nisli/packages/ledger
> vitest run --typecheck

Testing types with tsc and vue-tsc is an experimental feature.
Breaking changes might not follow SemVer, please pin Vitest's version when using it.

 RUN  v2.1.9 /Users/goga/Documents/goga/nisli/packages/ledger

 ✓ server/banking/categorization.test.ts (43 tests) 3ms
 ✓ src/data/finance/flow.test.ts (9 tests) 2ms
 ✓ src/data/finance/commitment.test.ts (13 tests) 4ms
 ✓ src/data/finance/safe-to-spend.test.ts (17 tests) 5ms
 ✓ server/banking/application.test.ts (7 tests) 8ms
 ✓ server/bank-sync.test.ts (25 tests) 17ms
 ✓ src/data/store.test.ts (8 tests) 325ms
 ✓ server/persistence.test.ts (13 tests) 395ms
 ✓ src/data/finance/period.test.ts (9 tests) 5ms
 ✓ src/data/finance/rollup.test.ts (5 tests) 3ms
 ✓ src/data/finance/delta.test.ts (7 tests) 5ms
 ✓ src/data/finance/money.test.ts (9 tests) 3ms
 ✓ src/data/review.test.ts (3 tests) 3ms
 ✓ src/data/bank.test.ts (1 test) 2ms
 ✓ src/data/csv.test.ts (3 tests) 2ms
 ✓ src/data/calendar.test.ts (2 tests) 1ms
 ✓ src/screens/screens.proof.test.ts (16 tests) 20842ms
   ✓ every screen is proven at five widths across density and input contexts > OverviewScreen 3614ms
   ✓ every screen is proven at five widths across density and input contexts > AccountsScreen 1330ms
   ✓ every screen is proven at five widths across density and input contexts > AccountScreen({ id: "card" }) 2772ms
   ✓ every screen is proven at five widths across density and input contexts > TransactionsScreen 4985ms
   ✓ every screen is proven at five widths across density and input contexts > BudgetsScreen 2309ms
   ✓ every screen is proven at five widths across density and input contexts > ImportScreen 533ms
   ✓ every screen is proven at five widths across density and input contexts > RulesScreen 1773ms
   ✓ every screen is proven at five widths across density and input contexts > ConnectionsScreen 1732ms
   ✓ every screen is proven at five widths across density and input contexts > SettingsScreen 1421ms

 Test Files  17 passed (17)
      Tests  190 passed (190)
Type Errors  no errors
   Start at  22:45:28
   Duration  22.03s (transform 836ms, setup 0ms, collect 1.42s, tests 21.62s, environment 4.38s, prepare 895ms)


```
