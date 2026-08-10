/**
 * Static HTML renderer for Nisli SSG output.
 *
 * This module is intentionally DOM-free. It renders tagged templates to HTML
 * strings for build-time/static use cases, not live browser bindings.
 */

import { raw, type RawHtml } from '@nisli/core';

export interface StaticResult {
  toString(): string;
  __staticResult: true;
}

// Brand unification (ADR 0030.2 §8 T4): core owns the __raw trusted-HTML
// brand (template.ts `raw()`, consumed by html:inner); this module re-exports
// it so one brand serves both the static renderer and the live engine.
// isRawHtml below stays structural, so values from older @nisli/ssg copies
// remain valid.
export { raw, type RawHtml };

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ESCAPE_MAP[ch] ?? ch);
}

function isStaticResult(value: unknown): value is StaticResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__staticResult' in value &&
    (value as StaticResult).__staticResult === true &&
    typeof (value as StaticResult).toString === 'function'
  );
}

function isRawHtml(value: unknown): value is RawHtml {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__raw' in value &&
    (value as RawHtml).__raw === true &&
    typeof (value as RawHtml).value === 'string'
  );
}

export function staticHtml(strings: TemplateStringsArray, ...values: unknown[]): StaticResult {
  const result: string[] = [];

  for (let i = 0; i < strings.length; i++) {
    result.push(strings[i] ?? '');

    if (i < values.length) {
      result.push(renderToString(values[i]));
    }
  }

  const output = result.join('');

  return {
    __staticResult: true as const,
    toString: () => output,
  };
}

export function renderToString(value: unknown): string {
  if (value == null || value === false || value === true) {
    return '';
  }

  if (isStaticResult(value)) {
    return value.toString();
  }

  if (isRawHtml(value)) {
    return value.value;
  }

  if (Array.isArray(value)) {
    return value.map(renderToString).join('');
  }

  return escapeHtml(String(value));
}
