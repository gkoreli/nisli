/** A small, correct CSV reader: quotes, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export type DateFormat = 'YMD' | 'DMY' | 'MDY';

/** "2026-08-03", "03/08/2026", "8/3/26", "03.08.2026" → "2026-08-03" (or undefined). */
export function parseDate(raw: string, format: DateFormat): string | undefined {
  const m = raw.trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
  if (!m) return undefined;
  let [, a, b, c] = m as unknown as [string, string, string, string];
  let y: number, mo: number, d: number;
  if (format === 'YMD') { y = +a; mo = +b; d = +c; }
  else if (format === 'DMY') { d = +a; mo = +b; y = +c; }
  else { mo = +a; d = +b; y = +c; }
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "-1,234.56", "(12.00)", "1 234,56 ₾", "$42" → cents (or undefined). */
export function parseAmount(raw: string): number | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  const negativeParens = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/[^\d,.\-+]/g, '');
  // Decide the decimal separator: the last of , or . if followed by 1–2 digits.
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  const decimalSep = lastComma > lastDot && /,\d{1,2}$/.test(s) ? ',' : '.';
  s = decimalSep === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100) * (negativeParens ? -1 : 1);
}
