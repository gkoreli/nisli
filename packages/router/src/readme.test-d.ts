import { component, html } from '@nisli/core';
import { defineRouter, enumParam, route, type Router } from './index.js';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { nisliRoutes } from './vite.js';

declare function defineConfig<T>(config: T): T;

const HomePage = component('home-page', () => html`<h1>Home</h1>`);
const UserPage = component<{ userId: string; tab: 'profile' | 'activity' }>(
  'user-page',
  (props) => html`
    <h1>User ${props.userId.value}</h1>
    <p>${props.tab.value}</p>
  `,
);

const AppRouter = defineRouter({
  home: route('/', { render: async () => HomePage({}) }),
  user: route('/users/:userId', {
    query: { tab: enumParam(['profile', 'activity']).default('profile') },
    render: async ({ params, query }) => UserPage({
      userId: params.userId,
      tab: query.tab,
    }),
  }),
});

const App = component('my-app', () => html`${AppRouter({})}`);
html`${App({})}`.mount(document.body);

// README quick-start tail: keep the computed href + anchor consumption in sync.
const href = AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'activity' },
});

html`<a href="${href}">Activity</a>`;

// README Vite direct routes: mirror the full dev-only adapter snippet.
const viteConfig = defineConfig({
  plugins: [nisliHmr(), nisliRoutes(AppRouter)],
});
void viteConfig;

AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'activity' },
});

// README View Transitions: the policy callbacks and the per-navigation override.
const TransitioningRouter = defineRouter(
  { home: route('/', { render: async () => HomePage({}) }) },
  {
    viewTransitions: {
      enabled: (nav) => nav.to.pathname.startsWith('/blog'),
      types: (nav) => [nav.direction, nav.kind],
    },
  },
);
void TransitioningRouter;

declare const router: Router;
void router.navigate('/blog', { viewTransition: false });
void router.navigate('/blog', { viewTransition: true });
void router.navigate('/blog', { viewTransition: { types: ['zoom'] } });
