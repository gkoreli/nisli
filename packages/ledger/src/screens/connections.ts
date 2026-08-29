import { component, signal, computed, query } from '@nisli/core';
import { Page, Grid, Section, Stat, Table, Dialog, Form, Text, Empty, notify, confirm, type Column } from '@nisli/engine';
import { getBankStatus, createLinkToken, exchange, listItems, syncItem, removeItem, openPlaidLink, applySync, type BankItem } from '../data/bank.js';
import { lastSync, recordSync } from '../data/store.js';
import { money } from '../data/format.js';

type BankAccount = BankItem['accounts'][number];

const relative = (iso: string | undefined): string => {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const ConnectionsScreen = component('ledger-connections', () => {
  const items = query(() => ['bank', 'items'], () => listItems());
  const bank = query(() => ['bank', 'status'], () => getBankStatus(), { staleTime: 60_000 });
  const list = computed(() => items.data.value ?? []);

  const selected = signal<BankItem | undefined>(undefined);
  const open = signal(false);
  const close = () => { open.value = false; };

  const syncOne = async (item: BankItem) => {
    const r = applySync(item, await syncItem(item.id));
    recordSync(item.id, r.added);
    return r;
  };

  const connect = async () => {
    const t = await createLinkToken();
    if (t.mock) {
      await exchange({ mock: true, institution: 'Chase' });
    } else {
      if (!t.link_token) throw new Error('The server returned no link token.');
      const r = await openPlaidLink(t.link_token);
      await exchange({ public_token: r.public_token });
    }
    items.refetch();
    notify('Bank connected', 'positive');
  };

  const syncAll = async () => {
    let n = 0;
    for (const item of list.value) n += (await syncOne(item)).added;
    items.refetch();
    notify(`Synced ${n} transactions`, 'positive');
  };

  const newest = computed(() => Object.values(lastSync.value).map((s) => s.at).sort().at(-1));
  const importedFor = (id: string) => lastSync.value[id]?.added ?? 0;

  const columns: Column<BankItem>[] = [
    { id: 'institution', header: 'Institution', cell: (i) => i.institution, priority: 'primary' },
    { id: 'accounts', header: 'Accounts', cell: (i) => `${i.accounts.length} · ${i.accounts.map((a) => `••${a.mask}`).join(' ')}` },
    { id: 'sync', header: 'Last sync', kind: 'date', cell: (i) => relative(lastSync.value[i.id]?.at), priority: 'tertiary' },
    { id: 'imported', header: 'Imported', kind: 'number', cell: (i) => importedFor(i.id), priority: 'tertiary' },
  ];
  const accountColumns: Column<BankAccount>[] = [
    { id: 'name', header: 'Name', cell: (a) => a.name, priority: 'primary' },
    { id: 'mask', header: 'Mask', cell: (a) => `••${a.mask}`, priority: 'tertiary' },
    { id: 'type', header: 'Type', cell: (a) => a.subtype || a.type },
    { id: 'balance', header: 'Balance', kind: 'money', cell: (a) => money(Math.round(a.balance * 100)), priority: 'primary' },
  ];

  const connectAction = { id: 'connect', label: 'Connect a bank', priority: 'primary' as const, onSelect: connect };

  return Page({
    title: 'Banks',
    status: items,
    actions: [
      connectAction,
      { id: 'syncAll', label: 'Sync all', priority: 'secondary', onSelect: syncAll },
    ],
    children: computed(() => [
      Grid({
        children: [
          Stat({ label: 'Connected banks', value: String(list.value.length), status: items }),
          Stat({ label: 'Linked accounts', value: String(list.value.reduce((s, i) => s + i.accounts.length, 0)), status: items }),
          Stat({ label: 'Last sync', value: relative(newest.value), hint: newest.value ? new Date(newest.value).toLocaleString() : 'Nothing synced yet' }),
        ],
      }),
      ...(items.data.value && list.value.length === 0
        ? [Empty({ title: 'No banks connected', hint: 'Connect a bank to pull transactions automatically. Chase connects through Plaid; your credentials never touch this app.', action: connectAction })]
        : [Section({
            title: 'Connections',
            status: items,
            children: [Table<BankItem>({ columns, rows: list, key: (i) => i.id, onSelect: (i) => { selected.value = i; open.value = true; }, empty: 'No banks connected.' })],
          })]),
      Section({
        title: 'How this works',
        status: bank,
        children: [
          Text({ text: bank.data.value
            ? (bank.data.value.mode === 'plaid'
              ? `Connected to Plaid (${bank.data.value.env}). Chase and most US banks connect through Plaid’s OAuth flow.`
              : 'Running in mock mode: no Plaid credentials are configured, so “Connect a bank” links a simulated Chase with sample accounts. Set PLAID_CLIENT_ID and PLAID_SECRET on the server to go live.')
            : 'Checking the bank service…', role: 'body' }),
          Text({ text: 'Your bank login and access tokens live only on the Ledger server. The browser never sees them; it only asks the server to sync.', role: 'muted' }),
          Text({ text: 'Synced transactions are filed by your rules and de-duplicated against what is already here. Disconnecting a bank keeps everything imported.', role: 'muted' }),
        ],
      }),
      Dialog({
        title: computed(() => selected.value?.institution ?? 'Bank'),
        open,
        onClose: close,
        children: computed(() => selected.value ? [
          Text({ text: `Last sync ${relative(lastSync.value[selected.value.id]?.at)} · ${importedFor(selected.value.id)} imported`, role: 'muted' }),
          Table<BankAccount>({ columns: accountColumns, rows: selected.value.accounts, key: (a) => a.id }),
          Form<Record<string, never>>({
            fields: [],
            value: {},
            onSubmit: async () => {
              const r = await syncOne(selected.value!);
              items.refetch();
              notify(`Synced ${r.added} new${r.skipped ? `, ${r.skipped} already present` : ''}${r.removed ? `, ${r.removed} removed` : ''}`, 'positive');
            },
            submitLabel: 'Sync now',
            onCancel: close,
            destructive: {
              id: 'disconnect',
              label: 'Disconnect',
              destructive: true,
              onSelect: async () => {
                const item = selected.value!;
                if (await confirm({ title: `Disconnect ${item.institution}?`, message: 'Imported transactions stay; the bank link is removed.', destructive: true, confirmLabel: 'Disconnect' })) {
                  await removeItem(item.id);
                  items.refetch();
                  notify('Disconnected');
                  close();
                }
              },
            },
          }),
        ] : []),
      }),
    ]),
  });
});
