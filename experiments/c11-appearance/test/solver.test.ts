/**
 * solver.test.ts — the fit solver, driven through fake geometry.
 *
 * Every case here is a DECISION, not a rendering: given what the container and
 * its children measure, which declared degradations does the solver spend, in
 * what order, and what does it tell the document afterwards.
 */
import { describe, expect, it } from 'vitest';
import { solveFit } from '../src/appearance/fit/solver.js';
import { FakeWorld } from './fakes.js';
import type { Candidate, Priority, Strategy } from '../src/appearance/contracts.js';

function candidate(node: string, priority: Priority, strategy: Strategy): Candidate<string> {
  return { node, priority, strategy };
}

describe('solveFit — nothing to do', () => {
  it('applies no degradation when the content already fits', () => {
    const world = new FakeWorld({
      available: 300,
      children: [
        { id: 'label', intrinsic: 100 },
        { id: 'action', intrinsic: 80 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [candidate('action', 5, 'menu'), candidate('label', 1, 'truncate')],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(outcome.applied).toEqual([]);
    expect(outcome.passes).toBe(0);
    expect(world.outcome()).toEqual({ label: 'none', action: 'none' });
    expect(world.mutations.every((m) => m.kind === 'clear')).toBe(true);
    expect(world.marks).toEqual([{ state: 'settled', collapsed: 0 }]);
    // The overflow trigger is hidden before measuring — a visible affordance
    // would occupy inline space and skew every measurement that follows — and
    // it stays hidden, because nothing moved into it. How many times the
    // solver writes that is its business; the order and the end state are not.
    expect(world.reveals[0]).toBe(false);
    expect(world.reveals.at(-1)).toBe(false);
  });
});

describe('solveFit — degrading', () => {
  it('spends candidates in priority order and stops the moment it fits', () => {
    const world = new FakeWorld({
      available: 200,
      children: [
        { id: 'decoration', intrinsic: 30 },
        { id: 'timestamp', intrinsic: 40 },
        { id: 'excerpt', intrinsic: 120, clamped: 40 },
        { id: 'reply', intrinsic: 60 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [
        candidate('excerpt', 3, 'truncate'),
        candidate('reply', 1, 'menu'),
        candidate('decoration', 5, 'hide'),
        candidate('timestamp', 4, 'hide'),
      ],
      world.metrics,
      world.mutator,
    );

    // 250 wanted against 200: dropping the decoration leaves 220, dropping the
    // timestamp leaves 180. The excerpt and the reply are never touched, which
    // is the point of declaring priorities at all.
    expect(outcome.state).toBe('settled');
    expect(outcome.applied.map((d) => d.node)).toEqual(['decoration', 'timestamp']);
    expect(outcome.applied.map((d) => d.strategy)).toEqual(['hide', 'hide']);
    expect(outcome.passes).toBe(2);
    expect(world.outcome()).toEqual({
      decoration: 'hide',
      timestamp: 'hide',
      excerpt: 'none',
      reply: 'none',
    });
    expect(world.marks).toEqual([{ state: 'settled', collapsed: 2 }]);
    expect(world.reveals[0]).toBe(false);
    expect(world.reveals.at(-1)).toBe(false);
  });

  it('reveals the overflow trigger exactly when a candidate moved into the menu', () => {
    const world = new FakeWorld({
      available: 100,
      children: [
        { id: 'title', intrinsic: 80 },
        { id: 'star', intrinsic: 40 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [candidate('star', 5, 'menu')],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(world.reveals[0]).toBe(false);
    expect(world.reveals.at(-1)).toBe(true);
    expect(world.marks).toEqual([{ state: 'settled', collapsed: 1 }]);
  });

  it('keeps spending candidates when revealing the trigger costs the space it just saved', () => {
    // The early-stop defect, and the reason it is worth a fixture of its own:
    // a solver must measure the world it CREATES, including its own
    // affordances. Revealing the overflow trigger only after the loop meant
    // every pass measured a geometry with no trigger in it, the loop stopped
    // the instant the container fit, and the trigger then consumed the space
    // that made it fit — reporting unsatisfiable with a declared candidate
    // still in hand.
    //
    // Here the trigger is worth 30. Menuing the star alone leaves 60 + 40 =
    // 100, exactly the budget, which is where the old ordering stopped; with
    // the trigger counted it is 60 + 40 + 30 = 130 and the archive must go
    // too. So this fixture fails under the old ordering and passes under the
    // new one, rather than merely accompanying the fix.
    const world = new FakeWorld({
      available: 100,
      trigger: 30,
      children: [
        { id: 'title', intrinsic: 60 },
        { id: 'star', intrinsic: 40 },
        { id: 'archive', intrinsic: 40 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [candidate('star', 5, 'menu'), candidate('archive', 4, 'menu')],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(outcome.applied.map((d) => d.node)).toEqual(['star', 'archive']);
    expect(outcome.passes).toBe(2);
    expect(world.marks).toEqual([{ state: 'settled', collapsed: 2 }]);
    // Revealed while there was still a candidate to spend, not afterwards.
    expect(world.reveals.at(-1)).toBe(true);
  });

  it('spends the last declared candidate before reporting unsatisfiable', () => {
    // `unsatisfiable` means every declared strategy is spent and it still does
    // not fit. A container that reports it while holding an unspent candidate
    // is not describing the document, it is describing a bug in the solver.
    const world = new FakeWorld({
      available: 120,
      children: [
        { id: 'avatar', intrinsic: 40 },
        { id: 'sender', intrinsic: 60 },
        { id: 'excerpt', intrinsic: 100, clamped: 20 },
        { id: 'star', intrinsic: 40 },
        { id: 'reply', intrinsic: 60 },
      ],
    });
    const candidates = [
      candidate('star', 5, 'hide'),
      candidate('excerpt', 4, 'truncate'),
      candidate('reply', 1, 'menu'),
    ];

    const outcome = solveFit(world.container, candidates, world.metrics, world.mutator);

    // 300 wanted against 120: hiding the star leaves 260, truncating the
    // excerpt leaves 180, and only spending the priority-1 reply gets to 120.
    // Priority orders WHEN a strategy is spent, never WHETHER.
    expect(outcome.state).toBe('settled');
    expect(outcome.applied).toHaveLength(candidates.length);
    expect(outcome.applied.map((d) => d.node)).toEqual(['star', 'excerpt', 'reply']);
  });

  it('counts only degradations that left the flow as collapsed', () => {
    const world = new FakeWorld({
      available: 100,
      children: [
        { id: 'excerpt', intrinsic: 90, clamped: 30 },
        { id: 'badge', intrinsic: 40 },
      ],
    });

    solveFit(
      world.container,
      [candidate('excerpt', 5, 'truncate'), candidate('badge', 4, 'hide')],
      world.metrics,
      world.mutator,
    );

    // Truncating the excerpt (90 → 30) alone brings 130 down to 70. The badge
    // stays, so nothing left the flow.
    expect(world.outcome()).toEqual({ excerpt: 'truncate', badge: 'none' });
    expect(world.marks).toEqual([{ state: 'settled', collapsed: 0 }]);
  });
});

describe('solveFit — F8: a crushed child inside a container that measures as fitting', () => {
  it('degrades even though the container reports no overflow', () => {
    // The recorded defect. Flex children default to `flex-shrink: 1`, so at
    // 320px the browser satisfied an overflowing row by squeezing its children
    // below their content width: the row reported scrollWidth 318 against
    // clientWidth 318 — settled, by a container-only test — while the Reply
    // wrapper reported clientWidth 32 against scrollWidth 71 and painted over
    // its neighbour. Buttons visibly overlapped and the solver did nothing.
    const world = new FakeWorld({
      crush: true,
      available: 318,
      children: [
        { id: 'avatar', intrinsic: 40 },
        { id: 'sender', intrinsic: 70 },
        { id: 'excerpt', intrinsic: 105, clamped: 60 },
        { id: 'star', intrinsic: 32 },
        { id: 'archive', intrinsic: 32 },
        { id: 'reply', intrinsic: 71 },
      ],
    });

    // Precondition: this is the state a container-only predicate calls settled.
    expect(world.metrics.overflows(world.container)).toBe(false);
    expect(world.metrics.crushed(world.container)).toBe(true);

    const outcome = solveFit(
      world.container,
      [
        candidate('star', 5, 'menu'),
        candidate('archive', 5, 'menu'),
        candidate('excerpt', 3, 'truncate'),
      ],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(outcome.applied.length).toBeGreaterThan(0);
    expect(outcome.applied[0]?.node).toBe('star');
    expect(world.metrics.crushed(world.container)).toBe(false);
    expect(world.marks[0]?.state).toBe('settled');
  });

  it('does not treat a declared truncation as a crush', () => {
    // A truncated node's content is wider than its box on purpose. Counting it
    // as a crush would make every truncation unsatisfiable.
    const world = new FakeWorld({
      crush: true,
      available: 100,
      children: [
        { id: 'excerpt', intrinsic: 200, clamped: 60 },
        { id: 'time', intrinsic: 30 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [candidate('excerpt', 5, 'truncate')],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(world.outcome()).toEqual({ excerpt: 'truncate', time: 'none' });
  });
});

describe('solveFit — exhaustion and termination', () => {
  it('reports unsatisfiable once every candidate is spent', () => {
    const world = new FakeWorld({
      available: 50,
      children: [
        { id: 'body', intrinsic: 100, clamped: 90 },
        { id: 'aside', intrinsic: 80 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [candidate('aside', 5, 'hide'), candidate('body', 1, 'truncate')],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('unsatisfiable');
    expect(outcome.applied.map((d) => d.node)).toEqual(['aside', 'body']);
    expect(outcome.passes).toBe(2);
    // `collapsed` counts what left the flow: the hidden aside, not the
    // truncated body.
    expect(world.marks).toEqual([{ state: 'unsatisfiable', collapsed: 1 }]);
  });

  it('reports unsatisfiable with no candidates at all', () => {
    const world = new FakeWorld({
      available: 40,
      children: [{ id: 'monolith', intrinsic: 400 }],
    });

    const outcome = solveFit(world.container, [], world.metrics, world.mutator);

    expect(outcome.state).toBe('unsatisfiable');
    expect(outcome.applied).toEqual([]);
    expect(outcome.passes).toBe(0);
  });

  it('consumes a strategy that changes no geometry instead of retrying it', () => {
    // `clamped` defaults to `intrinsic`, so truncating these buys nothing —
    // a one-word label already on one line. A solver that re-measured and
    // retried the same candidate because the container still overflowed would
    // never terminate.
    const world = new FakeWorld({
      available: 100,
      children: [
        { id: 'alpha', intrinsic: 120 },
        { id: 'beta', intrinsic: 120 },
        { id: 'gamma', intrinsic: 120 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [
        candidate('alpha', 5, 'truncate'),
        candidate('beta', 4, 'truncate'),
        candidate('gamma', 3, 'truncate'),
      ],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('unsatisfiable');
    expect(outcome.passes).toBe(3);
    expect(world.mutations.filter((m) => m.kind === 'apply')).toHaveLength(3);
  });

  it('skips a no-op candidate and still tries the ones behind it', () => {
    // The all-no-ops case above proves the loop TERMINATES. This one proves it
    // CONTINUES: "that changed nothing" must never be read as "we are done",
    // or the first badly-chosen strategy in the ladder silently disables every
    // strategy declared after it.
    const world = new FakeWorld({
      available: 100,
      children: [
        { id: 'title', intrinsic: 40 },
        { id: 'tag', intrinsic: 20 },
        { id: 'badge', intrinsic: 20 },
        { id: 'aside', intrinsic: 60 },
      ],
    });

    const outcome = solveFit(
      world.container,
      [
        // Two single-word labels: truncating them clamps to their own width.
        candidate('tag', 5, 'truncate'),
        candidate('badge', 4, 'truncate'),
        candidate('aside', 3, 'hide'),
      ],
      world.metrics,
      world.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(outcome.passes).toBe(3);
    expect(world.outcome()).toEqual({
      title: 'none',
      tag: 'truncate',
      badge: 'truncate',
      aside: 'hide',
    });
  });
});

describe('solveFit — idempotence', () => {
  it('reaches the same outcome when re-solved from an already degraded state', () => {
    const build = () =>
      new FakeWorld({
        available: 200,
        children: [
          { id: 'decoration', intrinsic: 30 },
          { id: 'timestamp', intrinsic: 40 },
          { id: 'excerpt', intrinsic: 120, clamped: 40 },
          { id: 'reply', intrinsic: 60 },
        ],
      });
    const candidates = [
      candidate('excerpt', 3, 'truncate'),
      candidate('reply', 1, 'menu'),
      candidate('decoration', 5, 'hide'),
      candidate('timestamp', 4, 'hide'),
    ];

    const world = build();
    const first = solveFit(world.container, candidates, world.metrics, world.mutator);
    const firstState = world.outcome();

    const second = solveFit(world.container, candidates, world.metrics, world.mutator);

    expect(second.state).toBe(first.state);
    expect(second.applied).toEqual(first.applied);
    expect(second.passes).toBe(first.passes);
    expect(world.outcome()).toEqual(firstState);
    expect(world.marks[1]).toEqual(world.marks[0]);
  });

  it('restores a candidate the second solve no longer needs', () => {
    // Solving must start from the undegraded state, or a container that grew
    // would keep a degradation it no longer needs and never recover. Solving
    // the same world with a larger budget must undo everything.
    const narrow = new FakeWorld({
      available: 100,
      children: [
        { id: 'title', intrinsic: 80 },
        { id: 'star', intrinsic: 40 },
      ],
    });
    solveFit(narrow.container, [candidate('star', 5, 'hide')], narrow.metrics, narrow.mutator);
    expect(narrow.outcome()).toEqual({ title: 'none', star: 'hide' });

    const wide = new FakeWorld({
      available: 400,
      children: [
        { id: 'title', intrinsic: 80 },
        { id: 'star', intrinsic: 40 },
      ],
    });
    wide.mutator.apply('star', 'hide');
    const outcome = solveFit(
      wide.container,
      [candidate('star', 5, 'hide')],
      wide.metrics,
      wide.mutator,
    );

    expect(outcome.state).toBe('settled');
    expect(outcome.applied).toEqual([]);
    expect(wide.outcome()).toEqual({ title: 'none', star: 'none' });
  });
});
