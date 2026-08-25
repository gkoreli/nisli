## 1. Verdict: UNSOUND

The brief should not pass a design gate. Its central premise—client setup can reconstruct everything except projected-content provenance—is contradicted by current Nisli behavior. SSG drops factory props, forwarded attributes, pin state, generated-ID seeds, callbacks, and object inputs. P1 therefore cannot reliably reproduce the server tree, and P2 lacks an inspectable template representation on which to build its proposed walker. The flag race, lifecycle overwrites, non-transactional projection, nested-island ordering, and invisible portal behavior are additional independent failures. Adoption remains worth pursuing, but this design needs a new serialization/replay contract and either a real template IR or minimal versioned markers.

## 2. Findings, ordered by severity

### 1. CRITICAL — REFUTED: provenance is not the only irrecoverable information

**Claim:** The same setup plus attribute-derived state reproduces the SSG output; only author-vs-rendered provenance needs serialization.

**Evidence:** Factory props remain JavaScript values inside the factory result ([component.ts:781](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:781)). SSG applies them through `_setProp`, not attributes ([core-render.ts:40](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:40)). The SSG test renders `title: 'Top Level Component'`, but the serialized host has only `class="hero"`—no title state ([build.test.ts:183](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.test.ts:183)). `_setProp` also records controlled pin state without reflecting the value ([component.ts:708](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:708)).

Forwarded attributes are worse: `id`/`name` are deliberately removed from the host during setup ([component.ts:431](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:431)). They survive only on the rendered inner control, so a newly parsed island host cannot seed them back.

The actual www corpus is dominated by factory-only state: buttons receive `variant` and `children`, inputs receive placeholders, and switches receive `checked` through factories ([examples.ts:172](/Users/goga/Documents/goga/nisli/packages/www/src/examples.ts:172)). The accordion preview passes its entire composition as nested factory `children` and item `value` props ([hydrate-examples/accordion.ts:17](/Users/goga/Documents/goga/nisli/packages/www/src/hydrate-examples/accordion.ts:17)). The proposed rule that factory/template children need no provenance is therefore backwards: without rerunning their owner, those children have no client source at all.

Module-global state also diverges. Accordion IDs come from `++uid` during setup ([accordion.ts:65](/Users/goga/Documents/goga/nisli/packages/www/src/nisli-ui/ui/accordion.ts:65), [accordion.ts:175](/Users/goga/Documents/goga/nisli/packages/www/src/nisli-ui/ui/accordion.ts:175)), while SSG renders routes sequentially in one module process ([build.ts:163](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.ts:163)). A fresh client module starts at zero and may adopt in a different order. The supposedly identical `aria-controls`/IDs will not be identical.

**Consequence:** P1 fresh-renders defaults or `undefined`; P2 immediately mismatches and repairs; forwarded form identity disappears; generated ARIA relationships change. The proposed www migration cannot replace its current frame loader with tag imports, because the current loader deliberately reruns the whole example factory ([loader.ts:46](/Users/goga/Documents/goga/nisli/packages/www/src/client/loader.ts:46)).

**Suggested revision:** Define an explicit resumability contract before designing adoption:

- Only opt-in roots whose complete setup inputs are serializable.
- Serialize declared props, pin state, forwarded values, and generated-ID seeds in a versioned island payload.
- Reject or require client boot code for callbacks, object graphs, services, refs, and factory-only children.
- Keep www previews as outer composition islands that rerun `getExample()`, or serialize their full input graph. Do not stamp every nested component independently.

T3 metadata alone does not solve this; the brief still needs a state emitter and replay protocol.

### 2. CRITICAL — REFUTED: T4 does not provide a usable P2 claim map

**Claim:** Cached parsing is the load-bearing capability needed for a generic `@nisli/core/adopt` walker.

**Evidence:** `TemplateResult` exposes only `mount`, `dispose`, and a brand ([template.ts:30](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:30)). The cached `HTMLTemplateElement`, template strings, values, and `processNode` machinery are private closures ([template.ts:101](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:101), [template.ts:238](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:238)). Mount still clones and walks from scratch ([template.ts:268](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:268)).

Nor is every result an `html()` result:

- `each()` owns private keys, item signals, wrappers, and child results ([template.ts:1015](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1015)).
- `el()` uses an entirely separate imperative construction path ([template.ts:1238](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1238)).
- Projection creates private ad-hoc `TemplateResult` implementations for existing nodes and text ([projection.ts:49](/Users/goga/Documents/goga/nisli/packages/core/src/projection.ts:49)).
- `when()` can expose a computed whose value is another opaque `TemplateResult` ([template.ts:1152](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1152)).

The surviving `<each-item>` wrappers are useful and confirmed ([template.ts:1098](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1098)), but they contain no serialized key and do not expose their child template.

**Consequence:** A subpath walker cannot inspect nested results, initialize `each()` entries, attach slot ownership, or perform region repair. Even compare-and-skip needs internal state: class binding currently starts with an empty owned-class set ([template.ts:781](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:781)); skipping its first application without seeding that set makes later removals incorrect.

**Suggested revision:** First add an internal adoption protocol or structural IR to every `TemplateResult` producer. For example, each result needs an internal `claim(cursor, context)` operation, not merely `mount`. Treat this as a prerequisite design in its own right. Otherwise retain minimal boundary markers and implement adoption inside the existing mounters rather than as an external generic walker.

### 3. HIGH — UNVERIFIABLE: marker-free lockstep survives the happy-dom → browser round trip

**Claim:** Binding positions can be recovered from cached parsing and expected values after SSG strips all runtime anchors.

**Evidence:** SSG parses and renders under happy-dom ([environment.ts:1](/Users/goga/Documents/goga/nisli/packages/ssg/src/environment.ts:1), [environment.ts:35](/Users/goga/Documents/goga/nisli/packages/ssg/src/environment.ts:35)). Client `parseTemplate()` uses that client realm’s actual `document` ([template.ts:122](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:122)). The current SSG then removes every slot/template/list/each boundary from the serialized string ([core-render.ts:13](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:13)); the existing test verifies only their absence ([build.test.ts:227](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.test.ts:227)). Runtime binding discovery walks concrete `childNodes` depth-first ([template.ts:300](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:300)).

There is no source proof that:

- Happy-dom serialization reparses to the same browser tree as the browser’s pristine template parse.
- Adjacent static/dynamic text can always be partitioned without anchors.
- Region endpoints remain unambiguous around nested templates, arrays, raw HTML, parser-inserted elements, or projection.
- Splice repair can identify its replacement extent after the very boundaries needed for containment were stripped.

**Consequence:** “Marker-free” is being chosen before its feasibility experiment. Mismatch repair does not make this safe if the repairer cannot determine the damaged region.

**Suggested revision:** Make marker removal an earned optimization. First run a real-browser round-trip corpus covering adjacent slots, entities, CR/LF, `<pre>`, tables, SVG, `html:inner`, arrays, `when`, `each`, nested factories, and projection. Until it is green, retain versioned slot/region anchors in adoptable output.

### 4. HIGH — REFUTED: `data-nisli-adopt && has children` kills WWW-14

**Claim:** A single flag branch prevents prior render output from entering the normal capture/mount path.

**Evidence:** Component registration is synchronous ([component.ts:755](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:755)), and `connectedCallback` immediately seeds, captures current children, runs setup, and appends a template ([component.ts:466](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:466)). Existing tests explicitly document that happy-dom connects an already-defined element before parsing its children ([projection.test.ts:58](/Users/goga/Documents/goga/nisli/packages/core/src/projection.test.ts:58)). The late-parser sweep exists to repair exactly that timing ([projection.ts:132](/Users/goga/Documents/goga/nisli/packages/core/src/projection.ts:132)).

Therefore a flagged host can have zero children at connect, take the fresh path, and receive the SSG children afterward—the duplication class survives.

There is also a sanctioned UI path that bypasses core capture entirely: `captureChildren()` directly removes every host child ([utils.ts:139](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/lib/utils.ts:139)), and textarea calls it during setup ([textarea.ts:73](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/textarea.ts:73)). Skipping core CAPTURE does not make setup safe while the old rendered tree remains in the host.

**Consequence:** The guarantee holds only for the current delayed-loader happy path, where definitions normally arrive after parsing. It is not “by construction” safe for pre-defined elements, `innerHTML`, client navigation, cached modules, or the sanctioned text-capture components.

**Suggested revision:** The flag alone must enter an adoption-pending state regardless of current child count. Resolve parser completion before setup, and migrate all direct host-child consumers behind an adoption-aware core API. Add defined-before-parse, defined-after-parse, `innerHTML`, empty-island, textarea, and true light-DOM tests in Chromium.

### 5. HIGH — REFUTED: P1 or node identity alone preserves usable form state

**Claim:** Snapshot/restore of values, checked state, focus, selection, and scroll provides “no lost input” and state continuity.

**Evidence:** Restoration is subsequently overwritten by normal initialization:

- `ui-input` explicitly reapplies its seed value in `onMount` ([input.ts:95](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/input.ts:95)).
- `ui-select` reapplies its initial value both synchronously and again in a microtask ([select.ts:117](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/select.ts:117)).
- Similar mount initialization exists for textarea, switch, checkbox, and slider.
- `AcpChat` initializes its logical draft signal to `''` ([acp-chat.ts:60](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/acp/acp-chat.ts:60)); the DOM-to-signal bridge runs only on future `input` events ([acp-chat.ts:152](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/acp/acp-chat.ts:152)). Restoring visible text without seeding `draft` leaves Submit reading an empty value ([acp-chat.ts:84](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/acp/acp-chat.ts:84)). P2 node identity does not fix that.
- `InputProps.type` is unrestricted ([input.ts:37](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/input.ts:37)); file selections cannot be restored through `.value`.

The mapping protocol is also UI-specific, not core-generic. Valid core SSG examples render elements with no `data-slot` ([build.test.ts:183](/Users/goga/Documents/goga/nisli/packages/ssg/src/build.test.ts:183)), and the registry itself contains scrollable nodes without `data-slot` ([acp-transcript.ts:81](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/acp/acp-transcript.ts:81)). MessageScroller schedules a forced bottom pin across two animation frames ([message-scroller.ts:129](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/message-scroller.ts:129)), well after the purported atomic restore.

**Consequence:** Typed text can be visibly restored and still be semantically empty, or be overwritten during mount. File inputs, multiple selects, `indeterminate`, IME composition, undo stacks, autofill state, custom validity, and non-`data-slot` scroll state remain outside the protocol.

**Suggested revision:** Introduce an adoption lifecycle with DOM-first initialization—e.g. `onAdopt(existingRoot)` or state adapters invoked before normal mount initializers. Components must reconcile preserved DOM state into their signals. Narrow P1’s promise until file, multi-select, dirty-value, focus events, IME, and delayed mount effects are explicitly tested.

### 6. HIGH — REFUTED: P1 is transactional and keeps the baseline on setup/mount failure

**Claim:** Everything before the swap leaves the prerendered baseline untouched, and setup or mount failure preserves it.

**Evidence:** Projection values are real nodes. `children()` removes captured nodes ([projection.ts:102](/Users/goga/Documents/goga/nisli/packages/core/src/projection.ts:102)), and its node template moves them into the new mount target ([projection.ts:49](/Users/goga/Documents/goga/nisli/packages/core/src/projection.ts:49)). “Lifting” provenance before setup or mounting the detached template therefore mutates the old tree before commit unless a new transactional projection mechanism is introduced.

Normal `onMount` callbacks run only after the template has committed ([component.ts:513](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:513)). An `onMount` throw thus occurs after the old children have been replaced. The current boundary disposes the scope and clears the host ([component.ts:550](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:550)); it has no rollback transaction.

The claimed `hydrateFrame` precedent is overstated. It calls `replaceChildren()` before mounting ([hydrate-frame.ts:18](/Users/goga/Documents/goga/nisli/packages/www/src/client/hydrate-frame.ts:18)); its test proves baseline preservation only for a rejected module load, before replacement ([hydrate-frame.test.ts:25](/Users/goga/Documents/goga/nisli/packages/www/src/client/hydrate-frame.test.ts:25)). A mount failure loses the baseline.

**Consequence:** Setup can hollow out projected content, and mount failure can leave neither baseline nor live tree. “Atomic” means, at most, one synchronous visual commit; it does not imply rollback, event atomicity, focus continuity, or immunity from microtask/RAF mutations.

**Suggested revision:** Specify a real prepare/commit/rollback transaction:

- Do not move projected nodes during prepare.
- Retain all old-node references through mount callbacks.
- On N401/N402, dispose the new scope and restore the exact old nodes and state.
- Test load, setup, template-mount, projection, and `onMount` failures separately.

### 7. HIGH — REFUTED: every component host can be an independently scheduled island

**Claim:** Stamp every framework host; per-tag loading plus `whenDefined(providerTag)` handles arbitrary upgrade order.

**Evidence:** Context injection is synchronous: it immediately walks ancestors and throws when no provided value exists ([element-context.ts:107](/Users/goga/Documents/goga/nisli/packages/core/src/element-context.ts:107), [element-context.ts:130](/Users/goga/Documents/goga/nisli/packages/core/src/element-context.ts:130)). There is no provider-ready protocol or deferral in source. `providerTag` is currently diagnostic metadata, not a scheduling channel ([element-context.ts:88](/Users/goga/Documents/goga/nisli/packages/core/src/element-context.ts:88)).

`whenDefined()` would prove only that a constructor exists, not that a particular ancestor’s setup/adoption has completed successfully. Meanwhile P1 outer replacement destroys any inner island already adopted by an earlier tag import. The actual accordion is one factory-owned context tree ([hydrate-examples/accordion.ts:17](/Users/goga/Documents/goga/nisli/packages/www/src/hydrate-examples/accordion.ts:17)), not a set of independent resumable roots.

**Consequence:** Child-first loading can fail context lookup or adopt with missing props; parent-first P1 can destroy live child state. A setup failure is not retryable through another module import because the tag is already defined.

**Suggested revision:** P1 should initially stamp only outermost ownership roots. Add parent-before-child coordination and a per-host “provider ready/adopted” promise—not merely `whenDefined(tag)`. Replay child props before child setup. Nested independent islands should wait for P2 or an explicit ownership boundary.

### 8. MEDIUM-HIGH — REFUTED: portals are automatically “client-fresh” with no mismatch class

**Claim:** A missing portal subtree is one known splice and never a mismatch.

**Evidence:** `portal()` is a copy-in lifecycle helper. It moves a ref only during `onMount` ([portal.ts:63](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/lib/portal.ts:63), [portal.ts:78](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/lib/portal.ts:78)). SSG serializes only the route host’s `innerHTML` ([core-render.ts:17](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:17)), so moved portal content disappears from the snapshot. Yet the client template still structurally contains that subtree—for example the dialog portal wrapper ([dialog.ts:292](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/dialog.ts:292)).

Nothing in `TemplateResult`, the `ref` binding, or the cached parse says “this subtree will be portaled.” To the claim walker it is indistinguishable from a genuine missing subtree.

**Consequence:** P2 must report/repair it as a mismatch, contrary to the brief, or silently special-case missing DOM without evidence. Open-at-build portal content is also absent from the static baseline.

**Suggested revision:** Portal must participate in adoption explicitly: retain a versioned placeholder, or let `portal()` register a claim policy on the component scope. Add open and closed portal fixtures to the equivalence gate.

### 9. MEDIUM — UNVERIFIABLE, but not credible: 5–6 engineer-weeks

The estimate cannot be verified from source, but its assumed scope is false. P1 needs a state serializer/replayer, forwarded-attribute handling, generated-ID seeding, transactional rollback, generic state adapters, parser-order deferral, provider readiness, nested-island ownership, and migration of direct host-child capture. P2 needs an adoption protocol across `html`, signals, arrays, factories, `each`, `when`, `el`, projection, refs, classes, `html:inner`, portals, and repair.

This is not “500–700 LOC plus 900–1300 LOC” on the current abstractions. The current engine’s separate paths are visible in [template.ts:488](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:488), [template.ts:1015](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1015), [template.ts:1238](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1238), and [projection.ts:49](/Users/goga/Documents/goga/nisli/packages/core/src/projection.ts:49).

**Suggested revision:** Remove the schedule until two spikes land:

1. Serializable-state/P1 transaction on one real composed www example.
2. Internal claim protocol covering `html + each + projection + nested factory`.

Re-estimate from those diffs and their browser test matrix.

### What is actually CONFIRMED

- SSG genuinely mounts the live runtime under happy-dom, waits for microtask work, and snapshots the result ([core-render.ts:55](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:55)).
- It strips slot/template/list/each runtime comments today ([core-render.ts:13](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:13)).
- The present double-render cause is correctly identified: core captures existing children and appends a fresh result ([component.ts:487](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:487), [component.ts:513](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:513)).
- Detached fragment mounting is supported in practice, and reactive slots deliberately resolve their live parent after reparenting ([template.ts:515](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:515)).
- `<each-item style="display:contents">` survives serialization and is a useful coarse claim boundary ([template.ts:1098](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1098)).
- UI hosts are made layout-transparent during setup ([utils.ts:113](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/lib/utils.ts:113)). That helps pre-adoption layout when the style survives, but does not solve state or binding ownership.

## 3. Riskiest assumption and cheapest experiment

The riskiest assumption is that an independently loaded component module can reconstruct the setup inputs that produced an SSG host.

The cheapest decisive experiment is a single Playwright page, not the full equivalence sweep:

1. SSG-render a component invoked as `Probe({ label, children, id, name })`, where `label/children` are factory-only, `id/name` use `'forward'`, and setup creates a module-counter ID.
2. Parse that HTML in a fresh Chromium realm before loading the component module.
3. Type into and focus an inner input.
4. Import a minimal P1 adopt branch without rerunning the original factory.
5. Assert factory children, label, forwarded identity, generated ARIA IDs, input DOM value, component signal value, focus, and no duplicate roots.

This is under 100 lines and should fail before any P2 work. If it does, the brief’s governing principle is falsified experimentally, not merely argued.

## 4. Additional source couplings the brief missed

- `settle()` describes itself as the SSG async barrier ([settle.ts:19](/Users/goga/Documents/goga/nisli/packages/core/src/settle.ts:19)), but `renderToHtml()` currently calls only `tick()` ([core-render.ts:70](/Users/goga/Documents/goga/nisli/packages/ssg/src/core-render.ts:70)). Query/resource state can therefore differ before parser fidelity is even considered.
- Core has no public framework-component brand or registered tag manifest. `FrameworkComponent` is a function-local class ([component.ts:398](/Users/goga/Documents/goga/nisli/packages/core/src/component.ts:398)); SSG’s proposed “stamp every framework host” needs a new reliable identification mechanism.
- `data-slot` is an ADR 0022 UI convention, not a core contract, and it is not literally present on every rendered descendant—the dialog’s SVG, paths, and hidden span are counterexamples ([dialog.ts:275](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/ui/dialog.ts:275)).
- Platform-state-preserving `moveBefore()` is not landed in the cited paths: `each()` still reorders with `insertBefore` ([template.ts:1120](/Users/goga/Documents/goga/nisli/packages/core/src/template.ts:1120)), and portal uses `appendChild` ([portal.ts:84](/Users/goga/Documents/goga/nisli/packages/ui/registry/default/lib/portal.ts:84)). Adoption does not eliminate later focus/iframe/animation hazards from those moves.

## 5. Execution details

Model: `gpt-5.6-sol`  
Reasoning effort: `xhigh`

Files inspected included:

- The investment brief and Nisli framework skill instructions.
- Core: `component.ts`, `template.ts`, `projection.ts`, `signal.ts`, `lifecycle.ts`, `ref.ts`, `element-context.ts`, `settle.ts`, `index.ts`, package exports, and relevant component/template/projection/invariant tests.
- SSG: `core-render.ts`, `environment.ts`, `build.ts`, `render.ts`, and build/render tests.
- WWW: `hydrate.ts`, `hydrate-frame.ts` and test, `loader.ts`, `preview.ts`, `examples.ts`, `ui-component.ts`, and the accordion hydration example.
- UI registry/site copies: `utils.ts`, `portal.ts`, button, input, textarea, switch, checkbox, select, slider, accordion, dialog, popover, ACP chat/transcript, and message-scroller.
- ADRs 0018, 0022, 0025, and 0030.2.

No files were modified, and no web access was used.