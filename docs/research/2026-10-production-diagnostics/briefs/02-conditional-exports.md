# Bet: development/default exports automatically choose the right artifact

**Verdict: insufficient alone.**

The installed synthetic package exports a development entry and a production
default. Actual esbuild package resolution selects production when minification is
off and when NODE_ENV is explicitly defined as development. Only the explicit
development resolver condition selects the development entry. NODE_ENV replacement
and package condition resolution are different operations.

Lit demonstrates this is a legitimate distribution convention. Vite supports
mode-sensitive resolver conditions too. It nevertheless cannot be Nisli's sole
automatic dev switch if ordinary esbuild development should remain loud. Choosing
a development default instead leaves ordinary production esbuild on that default.

Keep conditional exports as a possible additional integration surface, not the
only production/development selection mechanism. Evidence is in
[integration-results.json](../experiments/bundle-contract/integration-results.json).
