/**
 * prove(content, { widths }) — mount a screen at each width with no browser
 * and return every layout the engine could not satisfy. An empty result is the
 * proof: at those widths, every decision was made and every essential thing
 * fits. No screenshot, no eyes.
 */
import { el, flushEffects, settle } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { onReport, type LayoutReport } from '../engine/report.js';
import { estimator } from './estimate.js';
import type { Content } from '../blocks/types.js';

export interface ProveOptions {
  widths: readonly number[];
  /** Microtask turns to allow after mount for deferred solves. Default 3. */
  turns?: number;
}

export type Proof = LayoutReport & { readonly frame: number };

export async function prove(make: () => Content, options: ProveOptions): Promise<Proof[]> {
  const found: Proof[] = [];
  for (const frame of options.widths) {
    const seen = new Set<string>();
    const stop = onReport((r) => {
      const key = `${r.code}|${r.block}|${r.detail}`;
      if (!seen.has(key)) { seen.add(key); found.push({ ...r, frame }); }
    });
    setMeasurer(estimator(frame));
    const host = document.createElement('div');
    host.style.width = `${frame}px`;
    document.body.appendChild(host);
    const tpl = el('div', { style: 'display:contents' }, [make()]);
    try {
      tpl.mount(host);
      flushEffects();
      for (let i = 0; i < (options.turns ?? 3); i++) { await Promise.resolve(); flushEffects(); }
      await settle();
      flushEffects();
    } finally {
      tpl.dispose();
      host.remove();
      stop();
      setMeasurer(null);
      document.body.style.overflow = '';
    }
  }
  return found;
}

export { estimator } from './estimate.js';
export type { LayoutReport } from '../engine/report.js';
