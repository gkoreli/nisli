import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Section, Stat, Link, Dialog, Form, type Field } from '@nisli/engine';
import type { Account, AccountKind } from '../data/model.js';
import { accounts, balance, addAccount, settings } from '../data/store.js';
import { money } from '../data/format.js';
import { AppRouter } from '../router.js';

const KIND_LABEL: Record<AccountKind, string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit card', investment: 'Investment' };

type Draft = { name: string; institution: string; kind: AccountKind; opening: number | undefined };
const empty: Draft = { name: '', institution: '', kind: 'checking', opening: undefined };

export const AccountsScreen = component('ledger-accounts', () => {
  const adding = signal(false);
  const opens = signal(0); // one draft per opening: the engine resets on a new key
  const fields: Field<Draft>[] = [
    { key: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Everyday Checking' },
    { key: 'institution', label: 'Institution', kind: 'text', required: true },
    { key: 'kind', label: 'Type', kind: 'select', required: true, options: (Object.keys(KIND_LABEL) as AccountKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
    {
      key: 'opening', label: 'Opening balance', kind: 'money', required: true, step: 0.01, hint: 'Negative for money owed',
      validate: (v, d) => (d.kind === 'credit' && typeof v === 'number' && v > 0 ? 'A credit card balance is money owed — enter it as zero or negative' : undefined),
    },
  ];
  const cards = computed(() =>
    accounts.value.map((a: Account) =>
      Section({
        title: a.name,
        children: [
          Stat({
            label: KIND_LABEL[a.kind],
            value: money(balance(a.id)),
            hint: a.external ? `${a.institution} · ${a.external.status === 'inactive' ? 'no longer reported by bank' : 'connected'}` : a.institution,
            delta: a.external?.status === 'inactive'
              ? { text: 'Inactive bank account', tone: 'warning' }
              : a.kind === 'credit' && balance(a.id) < 0 ? { text: 'Balance owed', tone: 'warning' } : undefined,
          }),
          Link({ href: AppRouter.routes.account.href({ params: { id: a.id } }), label: 'View transactions →' }),
        ],
      }),
    ),
  );
  return Page({
    title: 'Accounts',
    actions: [{ id: 'add', label: 'Add account', priority: 'primary', onSelect: () => { opens.value++; adding.value = true; } }],
    children: [
      Grid({ children: cards }),
      Dialog({
        title: 'Add account',
        open: adding,
        onClose: () => { adding.value = false; },
        children: computed(() => [
          Form<Draft>({
            fields, initial: empty, key: opens.value,
            onSubmit: (d) => { addAccount({ name: d.name, institution: d.institution, kind: d.kind, opening: Math.round((d.opening ?? 0) * 100), currency: settings.value.currency }); adding.value = false; },
            submitLabel: 'Add account', onCancel: () => { adding.value = false; },
          }),
        ]),
      }),
    ],
  });
});
