import { settings } from './store.js';
import { localDate, localMonth } from './calendar.js';

export const money = (cents: number, opts: { sign?: boolean } = {}) => {
  const { currency, locale } = settings.value;
  const f = new Intl.NumberFormat(locale, { style: 'currency', currency, signDisplay: opts.sign ? 'exceptZero' : 'auto' });
  return f.format(cents / 100);
};

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(settings.value.locale, { month: 'short', day: 'numeric' });
};

export const monthKey = (iso: string) => iso.slice(0, 7);
export const thisMonth = () => localMonth();
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(settings.value.locale, { month: 'long', year: 'numeric' });
};
export const monthShort = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(settings.value.locale, { month: 'short' }) + (m === 1 ? ` ’${String(y).slice(2)}` : '');
};
export const previousMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y!, m! - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
/** The n months ending at `key`, oldest first. */
export const lastMonths = (key: string, n: number): string[] => {
  const out: string[] = [key];
  while (out.length < n) out.unshift(previousMonth(out[0]!));
  return out;
};
export const today = () => localDate();
