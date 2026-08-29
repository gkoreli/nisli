import type { TemplateResult } from '@nisli/core';
import { defineRouter, route } from '@nisli/router';

type R = Promise<TemplateResult>;

export const AppRouter = defineRouter({
  overview: route('/', { render: async (): R => (await import('./screens/overview.js')).OverviewScreen({}) }),
  accounts: route('/accounts', { render: async (): R => (await import('./screens/accounts.js')).AccountsScreen({}) }),
  account: route('/accounts/:id', { render: async ({ params }): R => (await import('./screens/account.js')).AccountScreen({ id: params.id }) }),
  transactions: route('/transactions', { render: async (): R => (await import('./screens/transactions.js')).TransactionsScreen({}) }),
  budgets: route('/budgets', { render: async (): R => (await import('./screens/budgets.js')).BudgetsScreen({}) }),
  import: route('/import', { render: async (): R => (await import('./screens/import.js')).ImportScreen({}) }),
  rules: route('/rules', { render: async (): R => (await import('./screens/rules.js')).RulesScreen({}) }),
  connections: route('/connections', { render: async (): R => (await import('./screens/connections.js')).ConnectionsScreen({}) }),
  settings: route('/settings', { render: async (): R => (await import('./screens/settings.js')).SettingsScreen({}) }),
});

export const nav = [
  { label: 'Overview', href: AppRouter.routes.overview.href({}) },
  { label: 'Accounts', href: AppRouter.routes.accounts.href({}) },
  { label: 'Transactions', href: AppRouter.routes.transactions.href({}) },
  { label: 'Budgets', href: AppRouter.routes.budgets.href({}) },
  { label: 'Import', href: AppRouter.routes.import.href({}) },
  { label: 'Rules', href: AppRouter.routes.rules.href({}) },
  { label: 'Banks', href: AppRouter.routes.connections.href({}) },
  { label: 'Settings', href: AppRouter.routes.settings.href({}) },
] as const;
