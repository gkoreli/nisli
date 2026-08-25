/**
 * report.ts — findings to counts and to text.
 *
 * Plain text, aligned columns, no colour escapes and no emoji: this output is
 * read in a terminal, in a CI log, in a browser panel and in a diff, and only
 * one of those four renders decoration.
 */

import type { Finding, Severity } from '../contracts.js';

/** Width of the longest severity word, so the code column always lines up. */
const SEVERITY_WIDTH = 10;
const CONTINUATION = ' '.repeat(SEVERITY_WIDTH + 8);

export function summarize(findings: readonly Finding[]): {
  fail: number;
  warn: number;
  incomplete: number;
} {
  const counts: Record<Severity, number> = { fail: 0, warn: 0, incomplete: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

export function formatFindings(findings: readonly Finding[]): string {
  // The formatter owns the clean case: every caller would otherwise invent its
  // own wording for "nothing to report".
  if (findings.length === 0) return 'PASS · no findings';
  const lines: string[] = [];
  for (const finding of findings) {
    lines.push(
      `${finding.severity.toUpperCase().padEnd(SEVERITY_WIDTH)} ${finding.code} · ${finding.subject} — ${finding.detail}`,
    );
    if (finding.hint) lines.push(`${CONTINUATION}${finding.hint}`);
  }
  return lines.join('\n');
}
