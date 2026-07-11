/**
 * lib/typeahead.ts — printable-key item search for menus and listboxes.
 *
 * Port of the typeahead behavior inside Radix's menu primitives (MIT —
 * https://github.com/radix-ui/primitives): typing accumulates a search
 * string that resets after a pause; the search matches item labels starting
 * from the item after the current one (wrapping), so repeating the same
 * first letter cycles through items sharing it.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

export interface TypeaheadOptions {
  /** ms of inactivity before the search buffer resets. Default `1000`. */
  resetMs?: number;
}

export interface Typeahead {
  /**
   * Feed a keydown. Returns the matched index (into `labels`) or -1, and
   * `true`-handled only for single printable characters. `currentIndex` is
   * where the cycle starts (e.g. the focused item), -1 when none.
   */
  onKey(key: string, labels: string[], currentIndex: number): number;
  /** Clear the pending search buffer immediately. */
  reset(): void;
}

export function typeahead(options: TypeaheadOptions = {}): Typeahead {
  const { resetMs = 1000 } = options;
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReset = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      buffer = '';
      timer = null;
    }, resetMs);
  };

  return {
    onKey(key: string, labels: string[], currentIndex: number): number {
      // Only single printable characters; a leading space is an activation
      // key in menus, not a search character.
      if (key.length !== 1 || (key === ' ' && buffer === '')) return -1;

      const repeatedChar = buffer.length > 0 && buffer === key.repeat(buffer.length);
      buffer += key;
      scheduleReset();

      const n = labels.length;
      if (n === 0) return -1;

      // Radix behavior: "aaa" cycles through items starting with "a" instead
      // of matching a literal "aaa" prefix.
      const search = repeatedChar || buffer.length === 1 ? key : buffer;
      // Single-char search starts AFTER the current item (so repeats cycle);
      // longer searches include it (so refining "ba" can stay in place).
      const start = currentIndex < 0 ? 0 : currentIndex + (search.length === 1 ? 1 : 0);

      for (let i = 0; i < n; i++) {
        const idx = (start + i) % n;
        if (labels[idx]?.toLowerCase().startsWith(search.toLowerCase())) return idx;
      }
      return -1;
    },

    reset(): void {
      buffer = '';
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
