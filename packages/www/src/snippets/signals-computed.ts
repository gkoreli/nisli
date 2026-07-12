import { signal, computed } from '@nisli/core';

const count = signal(2);
const doubled = computed(() => count.value * 2);

doubled.value; // 4 — lazy and cached
