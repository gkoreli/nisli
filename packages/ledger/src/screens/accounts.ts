import { component, signal, computed } from '@nisli/core';
import { Page, Grid, Section, Stat, Link, Dialog, Form, type Field } from '@nisli/engine';
import type { Account, AccountKind } from '../data/model.js';
import { accounts, balance, addAccount, settings } from '../data/store.js';
import { money } from '../data/format.js';
import { AppRouter } from '../router.js';

const KIND_LABEL: Record<AccountKind, string> = { checking: 'Checking', savings: 'Savings', credit: 'Credit card', investment: 'Investment', loan: 'Loan' };

type Draft = { name: string; institution: string; kind: AccountKind; opening: number | undefined };
const empty: Draft = { name: '', institution: '', kind: 'checking', opening: undefined };

export const AccountsScreen = component('ledger-accounts', () => {
  const adding = signal(false);
  const opens = signal(0); // one draft per opening: the engine resets on a new key
  const fields: Field<Draft>[] = [
    { name: 'name', label: 'Name', kind: 'text', required: true, placeholder: 'Everyday Checking' },
    { name: 'institution', label: 'Institution', kind: 'text', required: true },
    { name: 'kind', label: 'Type', required: true, options: (Object.keys(KIND_LABEL) as AccountKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
    {
      name: 'opening', label: 'Opening balance', kind: 'money', required: true, step: 0.01, hint: 'Negative for money owed',
      validate: (v, d) => (d.kind === 'credit' && typeof v === 'number' && v > 0 ? 'A credit card balance is money owed — enter it as zero or negative' : undefined),
    },
  ];
  // Net worth lives here, by every account it sums — not on the Overview
  // (which keeps decision-bearing numbers only). Tenet 6: accounts in another
  // currency are named and excluded, never converted into the sum.
  const inDefault = (a: Account) => a.currency.toUpperCase() === settings.value.currency.toUpperCase();
  const netWorth = computed(() => accounts.value.filter(inDefault).reduce((s, a) => s + balance(a.id), 0));
  const netWorthHint = computed(() => {
    const counted = accounts.value.filter(inDefault).length;
    const excluded = accounts.value.length - counted;
    return `Sum of ${counted} ${settings.value.currency} account balance${counted === 1 ? '' : 's'}${excluded ? ` · excludes ${excluded} in other currencies` : ''}`;
  });
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
      Grid({ children: [Stat({ label: 'Net worth', value: computed(() => money(netWorth.value)), hint: netWorthHint })] }),
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
