/**
 * hydrate-examples/carousel.ts — the carousel preview (WWW-15).
 *
 * Static in SSG (resting: slide 1, Previous disabled); once hydrated, the
 * Previous/Next arrows scroll the viewport — the WWW-15 guard clicks
 * `[data-slot="carousel-next"]` and asserts `[data-slot="carousel-content"]`
 * `scrollLeft > 0`. Per-file for code-splitting + auto-hydration.
 */
import { html, type TemplateResult } from '@nisli/core';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '../nisli-ui/ui/carousel.js';

const slide = (n: number): TemplateResult =>
  html`${CarouselItem({
    children: html`<div
      class="flex aspect-square items-center justify-center rounded-lg border p-6 text-4xl font-semibold"
    >${n}</div>`,
  })}`;

export default function carouselExample(): TemplateResult {
  return html`<div class="mx-auto max-w-xs px-12">
    ${Carousel({
      children: html`${CarouselContent({
        children: html`${slide(1)}${slide(2)}${slide(3)}`,
      })}
      ${CarouselPrevious({})}${CarouselNext({})}`,
    })}
  </div>`;
}
