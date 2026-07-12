/**
 * ui/input-otp.ts — InputOTP.
 *
 * Cited source: new-york-v4/ui/input-otp.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 *
 * DEVIATION (documented, ADR 0022 canonical-reference rule): upstream wraps
 * the `input-otp` package (unvendorable). We keep its VISUALS verbatim (slot
 * groups, border/rounding, active-slot ring, fake caret, minus separator) but
 * write the behavior ourselves.
 *
 * ARCHITECTURE DECISION — a SINGLE native `<input>`, not N inputs. The real
 * input holds the whole OTP string and is overlaid transparently across the
 * slots; the slot `<div>`s are presentation, reading each character + the
 * active/caret state from the shared context. This is the native-first choice
 * (ADR 0022 §5): one real form field carries the value (so `form.elements`,
 * `form.reset()`, and constraint validation just work), and paste-to-fill,
 * backspace-navigates, and auto-advance all come FREE from native single-input
 * behavior — plus `autocomplete="one-time-code"` gives browsers/OS the SMS-OTP
 * autofill hook. N separate inputs would fragment form participation and need
 * JS to split pastes; the single input reaches full parity, so we use it.
 *
 * `maxLength` sets the slot count; `pattern` (a RegExp source, e.g. `"[0-9]"`)
 * filters accepted characters. `value` mirrors the native attribute/property
 * split. Changes dispatch a bubbling `ui-value-change`; reaching `maxLength`
 * dispatches `ui-complete` (`detail: { value }`), both from the root host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  createContext,
  computed,
  effect,
  html,
  onMount,
  ref,
  signal,
  when,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

// ── Shared state (published on the <ui-input-otp> host) ──────────────

export interface InputOTPState {
  maxLength: number;
  charAt(index: number): string;
  isActive(index: number): boolean;
  hasFakeCaret(index: number): boolean;
}

/** Subtree-scoped channel from the InputOTP provider to its parts. */
const InputOTPContext = createContext<InputOTPState>('InputOTP', { providerTag: 'ui-input-otp' });

// ── ui-input-otp (root: single native input + shared slot state) ─────

export type InputOTPProps = {
  /** Number of slots. Required. */
  maxLength?: number;
  /** RegExp source filtering accepted characters (e.g. "[0-9]"). */
  pattern?: string;
  inputMode?: string;
  value?: string;
  defaultValue?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  /** The InputOTPGroup(s) of slots. */
  children?: string | TemplateResult;
};

export const InputOTP = component<InputOTPProps>('ui-input-otp', (props, host) => {
  transparentHost(host);

  // maxLength ('number', default 6) and pattern ('string') are declared in the
  // `attrs` option below and read reactively, so a live max-length/pattern
  // change flows through (slot count + the inner input's maxlength).
  const maxLength = computed(() => props.maxLength.value ?? 6);
  const regex = computed(() => {
    const p = props.pattern.value;
    return p ? new RegExp(p) : null;
  });
  // Remaining attribute fallbacks declared in the `attrs` option below.
  const inputMode = props.inputMode;
  const value = props.value;
  const defaultValue = props.defaultValue;
  const id = props.id;
  const name = props.name;
  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const className = props.className;
  const containerClassName = props.containerClassName;

  const current = signal<string>('');
  const caret = signal<number>(0);
  const focused = signal<boolean>(false);

  const sanitize = (raw: string): string => {
    const re = regex.value;
    let out = re ? Array.from(raw).filter((c) => re.test(c)).join('') : raw;
    if (out.length > maxLength.value) out = out.slice(0, maxLength.value);
    return out;
  };

  const emit = (name_: string): void => {
    host.dispatchEvent(
      new CustomEvent(name_, { detail: { value: current.value }, bubbles: true }),
    );
  };

  const state: InputOTPState = {
    get maxLength() { return maxLength.value; },
    charAt: (i) => current.value[i] ?? '',
    isActive: (i) => {
      if (!focused.value) return false;
      const active = Math.min(caret.value, maxLength.value - 1);
      return i === active;
    },
    hasFakeCaret: (i) => state.isActive(i) && current.value[i] == null,
  };
  InputOTPContext.provide(host, state);

  const root = ref<HTMLInputElement>();

  const syncCaret = (): void => {
    const el = root.current;
    if (el) caret.value = el.selectionStart ?? el.value.length;
  };

  const onInput = (): void => {
    const el = root.current;
    if (!el) return;
    const clean = sanitize(el.value);
    if (clean !== el.value) {
      el.value = clean;
      el.setSelectionRange?.(clean.length, clean.length);
    }
    current.value = clean;
    syncCaret();
    emit('ui-value-change');
    if (clean.length === maxLength.value) emit('ui-complete');
  };

  // Controlled value updates → the property (leaves the reset target alone).
  effect(() => {
    const v = value.value;
    const el = root.current;
    if (el && v != null && el.value !== v) {
      el.value = v;
      current.value = v;
    }
  });

  onMount(() => {
    const el = root.current;
    if (!el) return;
    const initial = value.value ?? defaultValue.value;
    if (initial != null) {
      const clean = sanitize(initial);
      el.setAttribute('value', clean); // native reset target
      el.value = clean;
      current.value = clean;
    }
  });

  const inputClasses = computed(() =>
    cn(
      'absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed',
      className.value,
    ),
  );
  const containerClasses = computed(() =>
    cn(
      'relative flex items-center gap-2 has-[input:disabled]:opacity-50',
      containerClassName.value,
    ),
  );

  return html`<div data-slot="input-otp" class="${containerClasses}">
    <input
      ref="${root}"
      data-slot="input-otp-input"
      type="text"
      inputmode="${computed(() => inputMode.value ?? (regex.value ? 'numeric' : 'text'))}"
      autocomplete="one-time-code"
      autocorrect="off"
      spellcheck="false"
      maxlength="${computed(() => String(maxLength.value))}"
      aria-label="One-time password"
      id="${id}"
      name="${name}"
      disabled="${disabled}"
      class="${inputClasses}"
      @input=${onInput}
      @focus=${() => {
        focused.value = true;
        syncCaret();
      }}
      @blur=${() => {
        focused.value = false;
      }}
      @click=${syncCaret}
      @keyup=${syncCaret}
    />
    ${children()}
  </div>`;
}, {
  attrs: {
    maxLength: { type: 'number', default: 6 },
    pattern: 'string',
    inputMode: 'string',
    value: 'string',
    defaultValue: 'string',
    className: 'string',
    containerClassName: 'string',
    id: 'forward',
    name: 'forward',
    disabled: 'boolean',
  },
});

// ── ui-input-otp-group ───────────────────────────────────────────────

export type InputOTPGroupProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const InputOTPGroup = component<InputOTPGroupProps>(
  'ui-input-otp-group',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn('flex items-center', className.value));
    return html`<div data-slot="input-otp-group" class="${classes}">${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-input-otp-slot ────────────────────────────────────────────────

export const inputOTPSlotClasses =
  'relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40';

export type InputOTPSlotProps = {
  /** Slot position (0-based). Required. */
  index?: number;
  className?: string;
  /**
   * Invalid state for THIS slot. Upstream spreads `{...props}`, landing
   * `aria-invalid` on the slot div that carries the `aria-invalid:` /
   * `data-[active=true]:aria-invalid:*` hooks. Our transparent host can't
   * forward implicitly, so we bind it onto the inner element — without this
   * the active+invalid parity tokens are unreachable dead CSS. Live boolean:
   * `<ui-input-otp-slot aria-invalid="true">` flows through post-mount too.
   */
  ariaInvalid?: boolean;
};

export const InputOTPSlot = component<InputOTPSlotProps>('ui-input-otp-slot', (props, host) => {
  const state = InputOTPContext.inject();
  transparentHost(host);

  const index = computed<number>(() => props.index.value ?? 0);
  const char = computed(() => state.charAt(index.value));
  const active = computed(() => state.isActive(index.value));
  const fakeCaret = computed(() => state.hasFakeCaret(index.value));

  const className = props.className;
  const classes = computed(() => cn(inputOTPSlotClasses, className.value));

  return html`<div
    data-slot="input-otp-slot"
    data-active="${computed(() => (active.value ? 'true' : 'false'))}"
    aria-invalid="${computed(() => (props.ariaInvalid.value ? 'true' : undefined))}"
    class="${classes}"
  >${char}${when(
    fakeCaret,
    html`<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div class="h-4 w-px animate-caret-blink bg-foreground duration-1000"></div>
    </div>`,
  )}</div>`;
}, { attrs: { index: { type: 'number', default: 0 }, className: 'string', ariaInvalid: 'boolean' } });

// ── ui-input-otp-separator ───────────────────────────────────────────

export type InputOTPSeparatorProps = {
  className?: string;
};

export const InputOTPSeparator = component<InputOTPSeparatorProps>(
  'ui-input-otp-separator',
  (props, host) => {
    transparentHost(host);
    const className = props.className;
    const classes = computed(() => cn(className.value));
    return html`<div data-slot="input-otp-separator" role="separator" class="${classes}"><svg
        class="size-4"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="M5 12h14"></path></svg></div>`;
  },
  { attrs: { className: 'string' } },
);
