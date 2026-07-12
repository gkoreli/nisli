import { enumParam, optional, route, stringParam } from './index.js';
import { html } from '@nisli/core';

const user = route('/users/:userId', {
  query: {
    tab: enumParam(['profile', 'activity'] as const),
    filter: optional(stringParam()),
  },
  render: () => html``,
});

user.href({ params: { userId: '42' }, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error missing path parameter
user.href({ params: {}, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error wrong path parameter name
user.href({ params: { id: '42' }, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error invalid enum query value
user.href({ params: { userId: '42' }, query: { tab: 'settings', filter: undefined } });
// @ts-expect-error missing required query properties
user.href({ params: { userId: '42' }, query: { tab: 'profile' } });
