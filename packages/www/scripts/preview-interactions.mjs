/**
 * The phone guard's explicit interaction contract. Every hydrated preview must
 * have one entry, and every entry must be hydrated. Keep mechanics in
 * preview-sweep.mjs; this file is the reviewable product-state manifest.
 */
export const INTERACTIONS = {
  accordion: { kind: 'expanded', target: '[data-slot="accordion-trigger"]' },
  'alert-dialog': { kind: 'overlay', target: 'button' },
  'button-group': { kind: 'button-group', target: 'button' },
  calendar: { kind: 'calendar', target: '[data-slot="calendar-day-button"]:not([disabled])' },
  carousel: { kind: 'carousel', target: '[data-slot="carousel-next"]' },
  checkbox: { kind: 'native-check', target: '[data-slot="checkbox"]', native: true },
  collapsible: { kind: 'expanded', target: '[data-slot="collapsible-trigger"]' },
  combobox: { kind: 'overlay', target: 'button' },
  command: { kind: 'alias', target: 'combobox' },
  'context-menu': { kind: 'context-menu', target: '[data-slot="context-menu-trigger"]' },
  dialog: { kind: 'overlay', target: 'button' },
  drawer: { kind: 'overlay', target: 'button' },
  'dropdown-menu': { kind: 'overlay', target: 'button' },
  'hover-card': { kind: 'overlay', target: '[data-slot="hover-card-trigger"]', desktopOnly: true },
  input: { kind: 'native-focus', target: '[data-slot="input"]', native: true },
  'input-otp': { kind: 'native-focus', target: '[data-slot="input-otp-input"]', native: true },
  menubar: { kind: 'overlay', target: 'button' },
  'navigation-menu': { kind: 'overlay', target: 'button' },
  popover: { kind: 'overlay', target: 'button' },
  'radio-group': { kind: 'native-check', target: '[data-slot="radio-group-item"]', native: true },
  resizable: { kind: 'resizable', target: '[data-slot="resizable-handle"]' },
  'scroll-area': { kind: 'scroll', target: '[data-slot="scroll-area-viewport"]' },
  select: { kind: 'native-select', target: '[data-slot="native-select"]', native: true },
  sheet: { kind: 'overlay', target: 'button' },
  slider: { kind: 'slider', target: '[data-slot="slider"]', native: true },
  switch: { kind: 'native-check', target: '[data-slot="switch"]', native: true },
  tabs: { kind: 'tabs', target: '[data-slot="tabs-trigger"]' },
  textarea: { kind: 'native-focus', target: '[data-slot="textarea"]', native: true },
  toast: { kind: 'toast', target: 'button' },
  toggle: { kind: 'toggle', target: '[data-slot="toggle"]' },
  'toggle-group': { kind: 'toggle', target: '[data-slot="toggle-group-item"]' },
  tooltip: { kind: 'overlay', target: 'button' },
};

// Independent audit ledger: deletion from INTERACTIONS must not silently make
// an interactive family disappear from the phone bar.
export const AUDITED_INTERACTIVE = Object.freeze([
  'accordion', 'alert-dialog', 'button-group', 'calendar', 'carousel',
  'checkbox', 'collapsible', 'combobox', 'command', 'context-menu', 'dialog', 'drawer',
  'dropdown-menu', 'hover-card', 'menubar', 'navigation-menu', 'popover',
  'input', 'input-otp', 'radio-group', 'resizable', 'scroll-area', 'select', 'sheet', 'slider',
  'switch', 'tabs', 'textarea', 'toast', 'toggle', 'toggle-group', 'tooltip',
]);

const KINDS = new Set(['alias', 'expanded', 'overlay', 'button-group', 'calendar', 'carousel', 'context-menu', 'native-check', 'native-focus', 'native-select', 'resizable', 'scroll', 'slider', 'tabs', 'toast', 'toggle']);

export function interactionCoverage(corpusNames, interactions = INTERACTIONS, audited = AUDITED_INTERACTIVE) {
  const corpus = new Set(corpusNames);
  const declared = new Set(Object.keys(interactions));
  return {
    missing: audited.filter((name) => !declared.has(name)).sort(),
    notHydrated: [...declared].filter((name) => !corpus.has(name)).sort(),
    invalid: Object.entries(interactions)
      .filter(([, value]) => !value?.target || !KINDS.has(value.kind))
      .map(([name]) => name)
      .sort(),
    orphanedAliases: Object.entries(interactions)
      .filter(([, value]) => value.kind === 'alias' && (!interactions[value.target] || interactions[value.target].kind === 'alias'))
      .map(([name]) => name)
      .sort(),
  };
}

export function assertInteractionCoverage(corpusNames, interactions = INTERACTIONS, audited = AUDITED_INTERACTIVE) {
  const gaps = interactionCoverage(corpusNames, interactions, audited);
  if (gaps.missing.length || gaps.notHydrated.length || gaps.invalid.length || gaps.orphanedAliases.length) {
    throw new Error(
      `touch interaction manifest mismatch: missing=[${gaps.missing}] not-hydrated=[${gaps.notHydrated}] invalid=[${gaps.invalid}] orphaned-aliases=[${gaps.orphanedAliases}]`,
    );
  }
}

export function isSweepFailure(result) {
  return (!result.upgrade.startsWith('OK') && !result.upgrade.startsWith('SKIP')) ||
    (result.open !== 'n/a' && !result.open.startsWith('OK')) ||
    (result.touch !== 'n/a' && !result.touch.startsWith('OK')) ||
    !result.fit.startsWith('OK') ||
    result.hydrated === 'MISSING' ||
    Boolean(result.err) ||
    Boolean(result.assetFails?.length);
}

export function phoneFit(scrollWidth, innerWidth, expectedWidth = 390) {
  const absolute = innerWidth === expectedWidth;
  const relative = scrollWidth <= innerWidth + 1;
  return absolute && relative
    ? `OK(${scrollWidth}/${innerWidth})`
    : `FAIL(${scrollWidth}/${innerWidth};expected=${expectedWidth})`;
}

export function drawerIsUseful(state) {
  return state.sheet && state.mobile && state.navItems > 0 && state.links > 0 &&
    state.validLinks === state.links && state.overflow <= 1;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    try {
      server.close((error) => error ? reject(error) : resolve());
    } catch (error) {
      reject(error);
    }
  });
}

export async function cleanupSweepResources({ phone, browser, server, primaryFailure }) {
  const cleanup = [];
  // Ownership order matters: closing Browser concurrently can destroy a child
  // BrowserContext while its close protocol is still in flight. Each operation
  // is nevertheless isolated so an earlier sync/async failure never prevents
  // later resources from being attempted.
  for (const close of [
    () => phone?.close(),
    () => browser?.close(),
    () => closeServer(server),
  ]) {
    try {
      await Promise.resolve().then(close);
      cleanup.push({ status: 'fulfilled', value: undefined });
    } catch (reason) {
      cleanup.push({ status: 'rejected', reason });
    }
  }
  const cleanupFailure = cleanup.find((result) => result.status === 'rejected');
  if (!primaryFailure && cleanupFailure?.status === 'rejected') throw cleanupFailure.reason;
  return cleanup;
}
