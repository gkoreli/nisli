# Executable `.nvis` example — Import transactions

[`import-transactions.nvis`](./import-transactions.nvis) is the application UI
source. It is a checksummed binary visual program with four observations,
persistent identities, width/state continuity, semantic ports, visual
materials, and an edit history. It contains no HTML, JSX, TypeScript component
tree, Engine block calls, or generated application code.

The generic [`runtime.mjs`](./runtime.mjs) decodes and observes the file
directly. [`viewer.mjs`](./viewer.mjs) is a Canvas backend for that runtime;
[`viewer.html`](./viewer.html) supplies only the development viewer chrome.
The runtime does not import [`paint-fixture.mjs`](./paint-fixture.mjs): that
script stands in for the future look → paint → bind editor and exists only to
make this example reproducible.

## Run

```sh
node docs/research/visual-programming/examples/import-transactions/generate.mjs
node --test docs/research/visual-programming/examples/import-transactions/runtime.test.mjs
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/docs/research/visual-programming/examples/import-transactions/viewer.html
```

The width slider and state selector are observation inputs. Clicking the file
control activates the `file` port and moves the example to the populated state;
clicking the import action sends `importAction` to domain code. No UI source is
generated between those operations and the displayed interface.

## Binary envelope

```text
bytes 0–3    NVIS
bytes 4–5    format version, little-endian
bytes 6–7    flags
bytes 8–11   payload length
bytes 12–15  FNV-1a checksum
bytes 16…    deterministic typed visual-object values
```

The payload's primitive instruction set is deliberately small:

- visual marks: surface, text, control, rule, repeated visual pattern;
- observations indexed by named state and width topology;
- identities with continuity modes;
- typed semantic ports;
- materials and typography;
- edit operations.

Those records are runtime memory, not a textual authoring syntax. A real visual
editor would mutate and save the same binary object directly.
