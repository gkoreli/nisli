/**
 * The test kernel: mount one block at a width with no browser.
 *
 *   const t = mount(Section, { title: 'S', children }, { width: 800 });
 *   t.styleOf('h3').display  // → 'block'
 *   t.unmount();
 *
 * The measurer seam answers every `measure()` from the options: the block's
 * host is `width` wide, the document is `viewport` wide, text-shaped elements
 * are sized by `text` (see `textMeasurer`), and everything else is the frame.
 */
import { el as element, flushEffects, type TemplateResult } from '@nisli/core';
import type { Content } from '../blocks/types.js';
import { setMeasurer, remeasure, type Measurer } from '../engine/measure.js';
import { useSkin, setScheme, type Scheme } from '../skin.js';
import { defaultSkin } from '../skin/default.js';
import { metrics } from '../metrics.js';
import { labelWidth } from '../engine/space.js';

export interface MountOptions {
  /** The block's own inline size. Default 800. */
  width?: number;
  /** The document's inline size, for blocks that float. Default `width`. */
  viewport?: number;
  /** Install the default skin at this scheme; bare when omitted. */
  scheme?: Scheme;
  /** Sizes text-shaped elements (titles, buttons, cells); `undefined` falls through to the frame. */
  text?: (el: HTMLElement) => number | undefined;
}

export interface Mounted {
  /** The block's custom element. */
  readonly el: HTMLElement;
  /** Inline style of the first element matching `selector` (the block itself when omitted). */
  styleOf(selector?: string): CSSStyleDeclaration;
  /** The frame changes: the block is now `width` wide (and the document `viewport`, default `width`); every block re-decides. */
  resize(width: number, viewport?: number): void;
  /** Dispose the block and restore the measurer, skin and document. */
  unmount(): void;
}

type Factory = (props: never) => Content;

const TEXTUAL = new Set(['H1', 'H2', 'H3', 'TH', 'TD', 'BUTTON', 'SPAN', 'A', 'LABEL', 'OPTION']);

/**
 * A text measurer: text-shaped elements are `charWidth` per character
 * (`labelWidth`, the engine's own estimate), and a button adds its horizontal
 * padding. Deterministic, so a plan is arithmetic.
 */
export function textMeasurer(charWidth: number): (el: HTMLElement) => number | undefined {
  return (el) => {
    if (!TEXTUAL.has(el.tagName)) return undefined;
    return labelWidth(el.textContent ?? '', el.tagName === 'BUTTON' ? 2 * metrics.control.padX : 0, charWidth);
  };
}

/** Mount a block by tag (props set through the element) or by factory, at a width. */
export function mount(target: string | Factory, props: Record<string, unknown>, options: MountOptions = {}): Mounted {
  let width = options.width ?? 800;
  let viewport = options.viewport ?? width;
  const frame = document.createElement('div');
  document.body.appendChild(frame);

  let el: HTMLElement;
  let tpl: TemplateResult | null = null;
  if (typeof target === 'string') {
    el = document.createElement(target);
    for (const [k, v] of Object.entries(props)) (el as unknown as { _setProp(k: string, v: unknown): void })._setProp(k, v);
  } else {
    tpl = element('div', { style: 'display:contents' }, [target(props as never)]);
    el = frame; // replaced after mount by the first element the factory made
  }

  const measurer: Measurer = (node) => {
    if (node === el) return width;
    if (node === document.documentElement) return viewport;
    return options.text?.(node) ?? width;
  };
  setMeasurer(measurer);
  if (options.scheme) useSkin(defaultSkin, { scheme: options.scheme });

  if (tpl) { tpl.mount(frame); el = (frame.querySelector<HTMLElement>(':scope > div > *')) ?? frame; }
  else frame.appendChild(el);
  flushEffects();

  return {
    el,
    styleOf: (selector) => (selector ? el.querySelector<HTMLElement>(selector) : el)?.style ?? (() => { throw new Error(`mount(): nothing matches "${selector}"`); })(),
    resize: (w, v = w) => {
      width = w; viewport = v;
      remeasure();
      window.dispatchEvent(new Event('resize'));
      flushEffects();
    },
    unmount: () => {
      if (tpl) tpl.dispose();
      frame.remove();
      setMeasurer(null);
      if (options.scheme) { useSkin(null); setScheme('system'); }
      document.body.style.overflow = '';
    },
  };
}
