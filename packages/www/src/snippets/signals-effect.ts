import { signal, effect } from '@nisli/core';

const count = signal(0);

effect(() => console.log('count is', count.value));
// logs "count is 0" now, and again on every change
