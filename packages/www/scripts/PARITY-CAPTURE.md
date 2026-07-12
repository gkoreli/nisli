# UI parity capture harness

`parity-capture.mjs` creates one side-by-side contact sheet per registry UI
item for criterion-2 human review. It does not compare pixels, score similarity,
or issue an automated visual verdict; ADR 0022's manual judgment rule remains
authoritative.

Run from the repository root after `pnpm install` (Playwright Chromium is the
only browser dependency):

```sh
node packages/www/scripts/parity-capture.mjs --out=/tmp/nisli-parity
```

Useful options:

- `--names=button,dialog,tooltip` captures a deterministic subset.
- `--plan` prints the complete deterministic URL/mapping/interaction plan and
  exits without launching a browser or writing output.
- `--nisli-base=https://nisli.dev` and `--shadcn-base=https://ui.shadcn.com/view/new-york-v4` override either live origin.
- `--timeout=20000` sets navigation/interaction timeouts in milliseconds.
- `--headed` shows Chromium while capturing.
- `--keep-partial` preserves a `.partial-<timestamp>` directory after a fatal
  browser/process failure; otherwise staging is removed.
- `--self-test-cleanup` injects a browser-close rejection and primary capture
  failure, then proves partial staging is retained without masking the primary
  error; it performs no network capture.

Output is assembled in a temporary sibling directory and atomically renamed to
the requested `--out` path only after enumeration completes. A pre-existing
destination is rejected without mutation. When `--out` is omitted, output goes
under the operating system's temporary directory, never the repository. Each component
directory contains `nisli.png`, `shadcn.png`, and `contact-sheet.png`.
`manifest.json` records every URL, interaction, route override, explicit
no-upstream disposition, and capture error. Individual navigation failures
produce diagnostic panels and a non-zero exit while retaining the complete
run; fatal failures close Chromium in `finally` and follow `--keep-partial`.
Browser-close and staging-cleanup failures are settled independently: a primary
capture failure remains primary, while cleanup failures surface when no primary
failure exists.
The harness starts no server: `--nisli-base` must already be reachable.

Route mappings are deliberately explicit: `form-field` uses `field-demo`,
`select` uses `native-select-demo` because Nisli deliberately tracks
`native-select.tsx` rather than Radix `select.tsx`, `toast` uses `sonner-demo`,
and `sidebar` uses the deterministic broad `sidebar-07` block because
`sidebar-demo` does not exist. Components with no
public default demo receive a visible NO-UPSTREAM panel containing the attempted
URL and reason; they are never silently skipped.
