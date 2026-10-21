# Bet 04 — Delegate overlay mechanics to the browser

**Revised verdict:** defer until a consumer demonstrates a concrete benefit worth
the parity risk. Native availability and possible code deletion do not justify
replacement on their own. This remains August bet 02, not a new strategic win.

**Evidence:** registry `lib/floating.ts:336` installs scroll/resize listeners,
`lib/focus.ts` implements focus trapping, and engine `blocks/kernel.ts:246`,
`:454` coordinates scroll locking and overlay placement. The
[CSSWG anchor spec](https://github.com/w3c/csswg-drafts/blob/main/css-anchor-position-1/Overview.bs)
and [HTML command/popover definitions](https://html.spec.whatwg.org/multipage/form-elements.html#the-button-element)
describe browser capabilities that may replace part of these mechanics.

**Prototype:** one modal dialog through native `<dialog>` and one anchored menu
through popover and feature-detected anchor positioning, retaining existing public
intent, events and controlled state. Own domain semantics, keyboard roving,
typeahead and transition coordination where necessary. Treat capability support
as a matrix to measure, not a Boolean inferred from the newest browser.

**Acceptance:** nested modal and nonmodal layers, Escape/cancel, outside pointer,
anchor toggling, focus entry/restore, scroll, RTL, transformed ancestors, animation
exit, nested browsing contexts where supported, and reduced-motion behavior in
Chromium/Firefox/WebKit. Count removed listeners, layout reads and code only after
parity. Registry changes start in copyable source and follow real sync workflow.

**Kill condition:** the browser and fallback stacks both remain permanently in
charge or native behavior breaks a supported contract. Popover is not a substitute
for modal semantics. No code-deletion or speedup number was measured in this pass.
