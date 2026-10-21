# Lifetime ownership independent of reactive tracking

**Scope:** reusable reactive framework code and component execution lifetimes.

**Candidate:** explicit owners collect descendant work; disposal and replacement
stop owned children. Detachment preserves intentionally longer lifetimes.
Untracking a read does not detach the lifetime. Existing effect behavior stays
available; compatibility is a design decision, not a safe global substitution.

**Evidence:** current setup-only context hook and explicit standalone disposer
contract; five passing checks over existing effect, including a baseline where
standalone nested effects outlive the outer disposer. Vue's effect-scope RFC and
current scope implementation provide a direct primary precedent.

**Category targeted:** collecting and forwarding cleanup handles through reusable
reactive helper composition. No application workflow or entity model is involved.

**Limits:** wrapper owns only other wrapper calls. It does not integrate query,
resource, emitter or DOM listeners; it does not propagate ownership across await.
Its retention/performance under heavy churn is unmeasured. It proves a mechanism,
not an established need to change current defaults.

**Next proof:** a compatibility design and lifecycle matrix across error,
replacement, moves/reconnect, disposal ordering and async completion; explicit
outside-owner/detached behavior; unchanged dependency tracking and scheduler
semantics. Reject the change if extra lifecycle concepts outweigh removed cleanup
obligations or if intentional current lifetimes cannot be preserved.
