/**
 * ssg-env.ts — install @nisli/ssg's happy-dom globals as a module side effect.
 *
 * `component()` subclasses `HTMLElement` at module-evaluation time
 * (packages/core/src/component.ts:399), so the DOM environment must exist BEFORE
 * any component module is imported. `renderToHtml()` calls
 * `ensureSsgDomEnvironment()` too late for that; www's static build gets the
 * globals from vitest's happy-dom environment instead
 * (packages/www/package.json:10). This probe runs under plain Node, so it
 * installs them explicitly and imports this module first.
 */
import { ensureSsgDomEnvironment } from '../../../../../packages/ssg/src/environment.js';

ensureSsgDomEnvironment();
