import { provide } from '@nisli/core';

class Clock {
  now() {
    return new Date().toLocaleTimeString();
  }
}

// Override what a token resolves to — e.g. a fixed clock in a test.
provide(Clock, () => ({ now: () => '12:00:00' }));
