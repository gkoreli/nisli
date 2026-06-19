/**
 * hmr/transform.ts — Shared source rewrite for Nisli HMR (ADR 0021, ADR 0110).
 *
 * Wraps the `component` a module imports from `@nisli/core` with the registry
 * indirection so a rebuilt module's `component()` calls re-register their setup
 * and trigger an in-place re-mount. Transport-agnostic and pure — used by both
 * the Vite `transform` hook.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrite a module's source so the `component` it imports from `coreSpecifier`
 * is wrapped by the registry indirection from `runtimeSpecifier`.
 *
 * Strategy: alias the real import, then shadow `component` with a wrapper that
 * registers the setup and passes a STABLE thunk to the real `component`. Cost:
 * one Map write + one thunk allocation per `component()` call.
 *
 * Returns the original source unchanged if it does not import `component` from
 * the core specifier (nothing to wrap) — the caller uses identity to decide
 * whether the module is HMR-relevant.
 */
export function transformSource(code: string, coreSpecifier: string, runtimeSpecifier: string): string {
  const spec = escapeRegExp(coreSpecifier);
  // Match a named import of `component` (alone or among others) from core.
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${spec}['"]`, 'g');

  let importsComponent = false;
  const rewritten = code.replace(importRe, (_full: string, names: string) => {
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean);
    const next = parts.map((p) => {
      // Handle `component` and `component as X` — we only wrap the bare name.
      if (p === 'component') {
        importsComponent = true;
        return 'component as __nisliRealComponent';
      }
      return p;
    });
    return `import { ${next.join(', ')} } from '${coreSpecifier}'`;
  });

  if (!importsComponent) return code;

  // Prepend the registry-import + wrapper. `__register` returns the STABLE
  // thunk the real component captures; the wrapper preserves the factory's
  // return value and signature.
  const preamble =
    `import { __register as __nisliRegister } from '${runtimeSpecifier}';\n` +
    `function component(tag, setup, opts) {\n` +
    `  return __nisliRealComponent(tag, __nisliRegister(tag, setup), opts);\n` +
    `}\n`;

  return preamble + rewritten;
}
