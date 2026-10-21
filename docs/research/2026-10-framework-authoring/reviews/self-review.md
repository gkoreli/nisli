# Adversarial self-review

This is the investigator's review, not an independent agent evaluation.

- The subject is now framework semantics. Neither prototype introduces app
  operations, CRUD schemas or a business workflow API.
- Compiler lowering is not transparent optimization. The maintainer confirmed
  that different compiled/buildless semantics are unacceptable; this product
  direction is withdrawn, including the opt-in version.
- A fixture list of signal names is not type-aware resolution. Name shadowing,
  imports/re-exports, aliases, hidden reads and purity remain unsolved. Rejecting
  recognized complex expressions is only a bounded safety measure.
- Existing computed wrappers, signal props and explicit snapshots remain valid
  in the probes. This does not prove arbitrary component code compiles correctly.
- Progress comparison uses a variant of real source with only binding expressions
  changed and a different tag; it is not a migration of production Progress.
- Happy-dom identity/edit-value checks do not establish real-browser focus,
  selection, IME, iframe, animation or paint behavior.
- Ownership baseline reflects documented explicit disposer behavior outside
  setup. It is not characterized as a core defect. The wrapper does not provide
  automatic ownership for the rest of the current framework or async continuations.
- Existing default lifetimes could be intentional. An owner API needs detachment
  and compatibility before any default changes; another ambient global alone
  would not make await safe.
- The framework skill itself contains historical guidance, e.g. it describes
  children sweep registration that the current dedicated projection phase changed.
  Current code/tests govern conclusions; skill text is a source of authoring-rule
  candidates, not proof that every old warning still describes current behavior.
- Seven plus five passing research checks and 465 baseline tests do not prove
  speed, productivity, or complete capability preservation of a new authoring
  model. Those claims remain gated on integration and broader tasks.
- Native expression callbacks are established practice, not a new 2026 invention,
  and shortening computed() alone is not a major leap. Generic function props
  must remain data; do not infer callback/getter intent from function arity.
- Reusing a live template instance is more consequential than caching parsed
  HTML, which core already does. Lit proves feasibility, not Nisli compatibility
  or speed. Reset identity, event closure replacement, child factory lifetimes,
  source-signal replacement and error recovery require independent evidence.

## Native-runtime continuation

- Frozen snapshot avoids racing the other lane's source changes. The frozen
  source and experiment modules are independently identified; tests are not a
  claim about the final working tree or later npm releases.
- The first prototype fails direct-factory retention and the impossible blanket
  claim of automatic entity-identity inference. Keep both red assertions.
- The refinement solves the tested direct-factory case using INTERNAL descriptor
  and _setProp contracts; it is not a production API or recursive renderer.
- Same tag/slot does not determine domain identity. Explicit reset keys remain
  necessary in cases where identical markup represents a new stateful entity.
- The Progress variant is manually authored, so no source compiler is smuggled
  into the design. Five fewer computed declarations are not measured agent gains.
- Browser modules are served unchanged, but the core TypeScript library is
  separately compiled/bundled with its production define. Report both facts.
- Browser focus/selection evidence covers text inputs. IME, composition events,
  native dialogs, animations, iframes, portals and SSR remain untested here.
- Existing each() works when created once. The probes do not make arbitrary
  map() calls keyed or resource creation inside repeated renders safe.
- The refined unit run has an N202 warning for a valid delayed callback-prop
  read. Do not hide it or describe the integration as diagnostic-free.
- Slider's snapshot behavior is recorded as a defect/hazard observation, not
  relabelled as correct merely because an observational assertion passes.
- No state-object proxy, DOM-property binding or component-returned-render API
  was shipped. Those remain separate design decisions, not implied by adapter
  success. The two current runtime strategies also have different work counts.
