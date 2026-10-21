import { component } from '@nisli/core';
import { progressClasses, progressIndicatorClasses } from '@fixture/progress';
import { cn, transparentHost } from '@fixture/utils';
import { record, region } from './prototype.mjs';

// Handwritten variant of the actual registry Progress. Same attributes,
// calculations and classes; the five computed declarations become locals.
export const ProgressRender = component('research-progress-render', (props, host) => {
  transparentHost(host);
  return region(() => {
    const value = props.value.value;
    const max = props.max.value ?? 100;
    const classes = cn(progressClasses, props.className.value);
    const state = value == null ? 'indeterminate' : value >= max ? 'complete' : 'loading';
    const indicatorStyle = `transform: translateX(-${100 - (value ?? 0)}%)`;
    return record`<div
      data-slot="progress" role="progressbar" aria-valuemin="0"
      aria-valuemax="${max}" aria-valuenow="${value}"
      data-state="${state}" data-value="${value}" data-max="${max}"
      class="${classes}"
    ><div data-slot="progress-indicator" class="${progressIndicatorClasses}"
      style="${indicatorStyle}"></div></div>`;
  });
}, { attrs: { value: 'number', max: { type: 'number', default: 100 }, className: 'string' } });
