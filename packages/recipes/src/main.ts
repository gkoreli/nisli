import { html } from '@nisli/core';
import '@nisli/intent/theme.css';
import { Shell } from './shell.js';

html`${Shell({})}`.mount(document.getElementById('root')!);

/**
 * Development only: the checker on `window.__rb`, so a probe or a devtools
 * console can ask "is this UI wrong" of whatever is on screen. Imported
 * dynamically from the `./devtools` subpath so a production bundle carries
 * none of it — that split is the package's own contract.
 */
if (import.meta.env.DEV) {
  const [{ solveAll, planOf }, devtools] = await Promise.all([import('@nisli/intent'), import('@nisli/intent/devtools')]);
  Object.assign(window, {
    __rb: {
      solveAll,
      planOf,
      check: (root: ParentNode = document) => devtools.check(devtools.domInspector(root)),
      format: devtools.formatFindings,
      summarize: devtools.summarize,
      explain: devtools.explain,
    },
  });
}
