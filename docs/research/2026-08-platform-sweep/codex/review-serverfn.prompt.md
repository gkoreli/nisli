Context: nisli — a fine-grained-signals web-component framework (repo at /Users/goga/Documents/goga/nisli; pnpm workspace: packages/core, router, ssg, ui, www). A draft investment brief proposes `@nisli/server`: a `serverFn({ input: StandardSchema, handler })` primitive with a `*.server.ts` module-boundary bundle split (SvelteKit-style, not AST extraction), POST-only JSON wire with typed errors/redirects, an ECMA-429-only ctx so one handler runs on Node and Cloudflare Workers, small adapters fronting SSG output, and a Better Auth recipe. Before any build, this design needs an independent adversarial review. You are the cross-lab reviewer; be skeptical, not polite.
Working directory: /Users/goga/Documents/goga/nisli (READ-ONLY — you must not modify anything).
Goal: adversarially review the brief at /private/tmp/claude-501/-Users-goga-Documents-goga-nisli/555a71eb-93f0-40a2-a436-90da1f5456d0/scratchpad/bets/bet-07-server-functions.md against the ACTUAL source. Verify its load-bearing claims by reading the code it cites, and attack the design where it is weakest.
Assigned execution: gpt-5.6-sol at xhigh.

Load-bearing claims to verify against source (not exhaustive — find your own):
- "The router's core-free catalog and purity guards are the perfect precedent" — read packages/router/src/ and the @nisli/router/catalog subpath; does the claimed purity/neutrality discipline actually exist as described, and does serverFn's design genuinely extend it or just gesture at it?
- "The Vite plugin is serve-only fallback with zero transform machinery (greenfield)" — read the router's Vite plugin; is a module-boundary split (`*.server.ts` → client fetch stubs) implementable there without fighting existing behavior? What does the plugin actually do today?
- "core's query()/QueryClient accepts stubs as fetchers with no API change" — read the T1 keyed logical-request query store in packages/core/src (landed in the AGN wave); check fetcher signature, abort/AbortSignal handling, error propagation: does a POST-fetch stub really slot in with zero API change, including the brief's typed fnError/fnRedirect semantics?
- The ECMA-429 ctx claim — is the proposed ctx surface actually within the Minimum Common Web API, or does it smuggle Node-isms (streams, buffers, env access)?
- Security defaults: is the CSRF story (as specced) actually safe for POST-only JSON endpoints across origins (content-type gating? origin check? SameSite assumptions)? Redacted-by-default errors — does the wire design leak stack/shape anywhere?
- The bundle-split leakage guard ("sentinel-grep") — is grep actually sufficient, or can re-exports/barrel files/type-only imports leak server code past it?
- SSG interplay: adapters "fronting static output" — check packages/ssg/src/build.ts output shape; any conflict between static route paths and serverFn endpoint paths?
- The ~6 engineer-week MVP estimate — honest, given what you see?

Constraints:
- Read-only. Cite file:line for every verified or refuted claim.
- Distinguish: CONFIRMED (verified in source) / REFUTED (contradicted by source, show the evidence) / UNVERIFIABLE (would need a prototype).
- No web access needed; judge against the code.

Return (final message = your report, ordered by severity):
1. Verdict: SOUND / SOUND-WITH-REVISIONS / UNSOUND, one paragraph.
2. Findings ordered by severity, each: claim → evidence (file:line) → consequence → suggested revision.
3. The single riskiest unproven assumption and the cheapest experiment that would test it.
4. Anything the brief missed that the source reveals (hidden coupling, existing code that helps or blocks).
5. Model and reasoning effort used; files inspected.
