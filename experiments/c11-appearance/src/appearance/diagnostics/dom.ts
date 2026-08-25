/**
 * dom.ts — the ONLY DOM reader in the diagnostics half.
 *
 * Everything the rules are allowed to know arrives through here, which is why
 * `grep -n 'document\.\|window\.\|getComputedStyle' rules/*.ts` returns nothing.
 * If this bet graduates, the rules move into @nisli/core untouched and this file
 * is the only part reviewed for byte cost and browser quirks.
 */

import type { Box, Inspector } from '../contracts.js';

/** Computed `background-color` values that paint nothing. */
const TRANSPARENT: Readonly<Record<string, true>> = {
  'rgba(0, 0, 0, 0)': true,
  transparent: true,
  '': true,
};

export function domInspector(root: ParentNode): Inspector<HTMLElement> {
  // The crush rule asks every element in the document for two properties. The
  // declaration object is live and resolves lazily per property, so keeping it
  // costs one WeakMap entry and saves a lookup per question.
  const declarations = new WeakMap<HTMLElement, CSSStyleDeclaration>();

  function styles(node: HTMLElement): CSSStyleDeclaration {
    let declaration = declarations.get(node);
    if (!declaration) {
      declaration = getComputedStyle(node);
      declarations.set(node, declaration);
    }
    return declaration;
  }

  return {
    all(selector: string): readonly HTMLElement[] {
      return [...root.querySelectorAll<HTMLElement>(selector)];
    },

    attr(node: HTMLElement, name: string): string | null {
      return node.getAttribute(name);
    },

    text(node: HTMLElement): string {
      return node.textContent ?? '';
    },

    describe(node: HTMLElement): string {
      const owner = node.closest('[data-component]')?.getAttribute('data-component');
      const tag = node.tagName.toLowerCase();
      return owner && owner !== tag ? `${owner} › ${tag}` : tag;
    },

    rendered(node: HTMLElement): boolean {
      // `display: contents` is the trap, and it is the single precondition for
      // every measuring rule in this set. Component hosts are layout-transparent
      // (app-text, app-button, …), so a host has NO box: clientWidth,
      // scrollWidth and every rect read 0. `checkVisibility()` nonetheless
      // returns TRUE for it — the round-2 corpus recorded exactly this
      // false-PASS ("checkVisibility on display:contents hosts fooled the
      // preview sweep"), and 0/0 geometry would otherwise surface as a crush or
      // a failed hit target. Answering "not rendered" here is honest for a
      // measurement question and keeps all nine rules free of the special case;
      // nothing is lost, because every declaration lives on the inner element
      // that IS the flex child. Rules that read declarations rather than
      // geometry (N601, N610) never ask this question.
      if (styles(node).display === 'contents') return false;
      // Otherwise the browser's own answer, which covers ancestors,
      // `visibility` and content-visibility in one call. Deliberately NOT
      // feature-detected: happy-dom v20 has no `checkVisibility`, and quietly
      // substituting a hand-rolled ancestor walk there would mean the unit
      // tests exercise a different definition of rendered-ness than the browser
      // does. A test environment that needs this polyfills it in its setup.
      return node.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true });
    },

    box(node: HTMLElement): Box {
      // `clientWidth` is the space the box GOT, `scrollWidth` the space its
      // content WANTS. Both are zero on a non-replaced inline element, so a
      // crush inside pure inline text is invisible to every measured rule —
      // the layout vocabulary produces flex and grid items, which do report.
      return { inline: node.clientWidth, block: node.clientHeight, contentInline: node.scrollWidth };
    },

    style(node: HTMLElement, property: string): string {
      return styles(node).getPropertyValue(property).trim();
    },

    backdrop(node: HTMLElement): string {
      for (let current: HTMLElement | null = node; current; current = current.parentElement) {
        const colour = styles(current).backgroundColor;
        if (!TRANSPARENT[colour]) return colour;
      }
      // Nothing in the ancestry paints, so the canvas shows through. Naming the
      // UA default beats reporting "transparent", which would make every
      // contrast ratio meaningless.
      return 'rgb(255, 255, 255)';
    },

    viewport(): { readonly inline: number; readonly documentInline: number } {
      return { inline: window.innerWidth, documentInline: document.documentElement.scrollWidth };
    },
  };
}
