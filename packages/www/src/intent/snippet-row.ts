/**
 * intent/snippet-row.ts — the smallest honest example, as a REAL module.
 *
 * This file exists to be rendered as source text on /intent (imported with
 * Vite's `?raw`, the same WWW-8 convention `src/snippets/**` uses), so the code
 * a reader copies is code that typechecks. It is deliberately never imported at
 * runtime: it calls `component()` at load, which needs a DOM.
 *
 * Everything below is the whole authoring surface. There is no `size` prop, no
 * `className`, no variant table and no breakpoint — and the exclusivity is not
 * tidiness, it is what makes derivation, checking and provenance possible at all.
 */
import { component, html } from '@nisli/core';
import { fit } from '@nisli/intent';

export const FeedRow = component<{ title: string; time: string }>(
  'app-feed-row',
  (props, host) => {
    fit(host); // the measured tier, attached in one line

    return html`<div data-fit data-layout="row" data-align="center">
      <span data-appearance="avatar">NI</span>

      <span data-text="title" data-collapse="truncate" data-priority="3">${props.title}</span>

      <span data-text="meta" data-collapse="hide" data-priority="4">${props.time}</span>

      <button data-appearance="action" data-role="primary">Read</button>
    </div>`;
  },
);
