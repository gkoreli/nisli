import { signal } from '@nisli/core';

const count = signal(0);

count.value; // 0 — read through .value
count.value = 5; // write; notifies readers
