/**
 * hydrate-set.ts — the set of component names that have an interactive
 * hydration example (src/hydrate-examples/*.ts). build.ts uses it to inject the
 * hydration script only on the /ui pages that need it; the client runtime globs
 * the same directory. Derived from the filenames, so adding an example wires
 * everything with no list to maintain.
 */
const modules = import.meta.glob('./hydrate-examples/*.ts');

export const hydrateSet: ReadonlySet<string> = new Set(
  Object.keys(modules).map((path) =>
    path.replace('./hydrate-examples/', '').replace(/\.ts$/, ''),
  ),
);
