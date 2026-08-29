import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Section, Stat, Link, Dialog, Form, type Field } from '@nisli/engine';
import type { Account, AccountKind } from '../data/model.js';
import { accounts, balance, addAccount } from '../data/store.js';
import { money } from '../data/format.js';
import { AppRouter } from '../router.js';

const KIND_LABEL: Record<AccountKind, string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit card', investment: 'Investment' };

type Draft = { name: string; institution: string; kind: AccountKind; opening: number | undefined };
const empty = (): Draft => ({ name: '', institution: '', kind: 'checking', opening: undefined });

export const AccountsScreen = component('ledger-accounts', () => {
  const adding = signal(false);
  const draft = signal<Draft>(empty());
  const fields: Field<Draft>[] = [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Everyday Checking' },
    { key: 'institution', label: 'Institution', kind: 'text', required: true },
    { key: 'kind', label: 'Type', kind: 'select', required: true, options: (Object.keys(KIND_LABEL) as AccountKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
    { key: 'opening', label: 'Opening balance', kind: 'money', required: true, hint: 'Negative for money owed' },
  ];
  const cards = computed(() =>
    accounts.value.map((a: Account) =>
      Section({
        title: a.name,
        children: [
          Stat({ label: KIND_LABEL[a.kind], value: money(balance(a.id)), hint: (a as { external?: { institution?: string } }).external ? `${a.institution} · connected` : a.institution, delta: a.kind === 'credit' && balance(a.id) < 0 ? { text: 'Balance owed', tone: 'warning' } : undefined }),
          Link({ href: AppRouter.routes.account.href({ params: { id: a.id } }), label: 'View transactions →' }),
        ],
      }),
    ),
  );
  return Page({
    title: 'Accounts',
    actions: [{ id: 'add', label: 'Add account', priority: 'primary', onSelect: () => { draft.value = empty(); adding.value = true; } }],
    children: [
      Grid({ children: cards }),
      Dialog({
        title: 'Add account',
        open: adding,
        onClose: () => { adding.value = false; },
        children: [
          Form<Draft>({
            fields, value: draft, onChange: (v) => { draft.value = v; },
            onSubmit: (d) => { addAccount({ name: d.name, institution: d.institution, kind: d.kind, opening: Math.round((d.opening ?? 0) * 100) }); adding.value = false; },
            submitLabel: 'Add account', onCancel: () => { adding.value = false; },
          }),
        ],
      }),
    ],
  });
});
