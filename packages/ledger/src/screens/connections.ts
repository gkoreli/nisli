import { component, signal, computed, query } from '@nisli/core';
import { Page, Grid, Section, Stat, Table, Dialog, Form, Text, Empty, notify, confirm, type Column } from '@nisli/engine';
import { getBankStatus, getFinancialComposition, createLinkToken, exchange, listConnections, syncConnection, syncAllItems, disconnectConnection, useLiveDataOnly, openPlaidLink, type BankConnection, type SyncSummary } from '../data/bank.js';
import { flushNow, lastSync, reloadFromServer } from '../data/store.js';
import { money } from '../data/format.js';

type BankAccount = BankConnection['accounts'][number];
type PendingLink = { linkToken: string; connectionId?: string };
const PENDING_LINK = 'ledger.plaid.pending-link';
const rememberLink = (pending: PendingLink) => sessionStorage.setItem(PENDING_LINK, JSON.stringify(pending));
const forgetLink = () => sessionStorage.removeItem(PENDING_LINK);
const recalledLink = (): PendingLink | undefined => {
  try {
    const value = sessionStorage.getItem(PENDING_LINK);
    return value ? JSON.parse(value) as PendingLink : undefined;
  } catch { return undefined; }
};

const relative = (iso: string | undefined): string => {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export const ConnectionsScreen = component('ledger-connections', () => {
  const items = query(() => ['bank', 'connections'], () => listConnections());
  const bank = query(() => ['bank', 'status'], () => getBankStatus(), { staleTime: 60_000 });
  const composition = query(() => ['bank', 'composition'], () => getFinancialComposition());
  const list = computed(() => items.data.value ?? []);

  const selected = signal<BankConnection | undefined>(undefined);
  const open = signal(false);
  const close = () => { open.value = false; };

  const syncOne = async (connection: BankConnection): Promise<SyncSummary> => {
    try {
      await flushNow();
      const result = await syncConnection(connection.id);
      await reloadFromServer();
      return result;
    } finally {
      await Promise.all([items.refetch(), composition.refetch()]);
    }
  };

  const finishLink = async (pending: PendingLink, result: Awaited<ReturnType<typeof openPlaidLink>>) => {
    let connection: BankConnection;
    if (pending.connectionId) {
      connection = list.value.find((candidate) => candidate.id === pending.connectionId)
        ?? (await listConnections()).find((candidate) => candidate.id === pending.connectionId)!;
      if (!connection) throw new Error('The bank connection no longer exists.');
    } else {
      if (!result.public_token) throw new Error('Plaid returned no public token.');
      connection = await exchange({ public_token: result.public_token, institution: result.institution });
    }
    await items.refetch();
    forgetLink();
    history.replaceState({}, '', location.pathname);
    await flushNow();
    const synced = await syncConnection(connection.id);
    await reloadFromServer();
    await Promise.all([items.refetch(), composition.refetch()]);
    notify(synced.historyStatus && synced.historyStatus !== 'HISTORICAL_UPDATE_COMPLETE'
      ? `${connection.institution} connected · transaction history is still loading; sync again shortly`
      : `${connection.institution} connected · ${synced.added} transactions imported`, 'positive');
  };

  const launchLink = async (connectionId?: string) => {
    const t = await createLinkToken(connectionId);
    if (t.mock) {
      const connection = await exchange({ mock: true, institution: 'Chase' });
      await syncOne(connection);
      notify('Mock bank connected', 'positive');
      return;
    }
    if (!t.link_token) throw new Error('The server returned no link token.');
    const pending = { linkToken: t.link_token, ...(connectionId ? { connectionId } : {}) };
    rememberLink(pending);
    try {
      await finishLink(pending, await openPlaidLink(t.link_token));
    } catch (error) {
      forgetLink();
      throw error;
    }
  };

  const resumeOauth = async () => {
    if (!new URLSearchParams(location.search).has('oauth_state_id')) return;
    const pending = recalledLink();
    if (!pending) {
      history.replaceState({}, '', location.pathname);
      notify('The Plaid session expired. Start the bank connection again.', 'warning');
      return;
    }
    try {
      await finishLink(pending, await openPlaidLink(pending.linkToken, location.href));
    } catch (error) {
      forgetLink();
      history.replaceState({}, '', location.pathname);
      notify(error instanceof Error ? error.message : 'Could not resume Plaid Link', 'warning');
    }
  };
  void resumeOauth();

  const syncAll = async () => {
    await flushNow();
    const results = await syncAllItems();
    await reloadFromServer();
    await Promise.all([items.refetch(), composition.refetch()]);
    const added = results.reduce((sum, result) => sum + (result.added ?? 0), 0);
    const failed = results.filter((result) => !result.ok).length;
    notify(`Synced ${added} transactions${failed ? ` · ${failed} connection${failed === 1 ? '' : 's'} need attention` : ''}`, failed ? 'warning' : 'positive');
  };

  const switchToLiveData = async () => {
    const live = list.value.filter((connection) => connection.source === 'live').length;
    if (!(await confirm({
      title: 'Start fresh with live data?',
      message: `This replaces every account and transaction with a fresh import from ${live} live connection${live === 1 ? '' : 's'}, and removes simulated connections. Categories, budgets, rules, and preferences stay. Ledger creates a restorable server backup first; it does not create another Plaid connection.`,
      confirmLabel: 'Start with live data',
      destructive: true,
    }))) return;
    await flushNow();
    const result = await useLiveDataOnly();
    await reloadFromServer();
    await items.refetch();
    await composition.refetch();
    notify(`Live data ready · ${result.accounts} accounts · ${result.added} transactions · previous data saved as ${result.backup}`, 'positive');
  };

  const newest = computed(() => Object.values(lastSync.value).map((s) => s.at).sort().at(-1));
  const importedFor = (id: string) => lastSync.value[id]?.added ?? 0;

  const columns: Column<BankConnection>[] = [
    { id: 'institution', header: 'Institution', cell: (i) => i.institution, priority: 'primary' },
    { id: 'source', header: 'Source', cell: (i) => i.source === 'live' ? `${i.provider} · ${i.environment}` : 'Simulated' },
    { id: 'accounts', header: 'Accounts', cell: (i) => `${i.accounts.length} · ${i.accounts.map((a) => `••${a.mask}`).join(' ')}` },
    { id: 'status', header: 'Status', cell: (i) => i.status === 'reauth-required' ? 'Reconnect' : i.status === 'disconnect-pending' ? 'Disconnect pending' : i.status === 'error' ? 'Error' : i.status === 'disabled' ? 'Paused' : i.historyStatus && i.historyStatus !== 'HISTORICAL_UPDATE_COMPLETE' ? 'Loading history' : 'Connected' },
    { id: 'sync', header: 'Last sync', kind: 'date', cell: (i) => relative(lastSync.value[i.id]?.at), priority: 'tertiary' },
    { id: 'imported', header: 'Imported', kind: 'number', cell: (i) => importedFor(i.id), priority: 'tertiary' },
  ];
  const accountColumns: Column<BankAccount>[] = [
    { id: 'name', header: 'Name', cell: (a) => a.name, priority: 'primary' },
    { id: 'mask', header: 'Mask', cell: (a) => `••${a.mask}`, priority: 'tertiary' },
    { id: 'type', header: 'Type', cell: (a) => a.subtype || a.type },
    { id: 'balance', header: 'Balance', kind: 'money', cell: (a) => money(a.balanceMinor), priority: 'primary' },
  ];

  const connectAction = { id: 'connect', label: 'Connect a bank', priority: 'primary' as const, onSelect: () => launchLink() };
  const hasNonLiveData = computed(() => {
    const value = composition.data.value;
    return !!value && value.accounts.simulated + value.accounts.unowned + value.transactions.simulated + value.transactions.unowned > 0;
  });
  const pageActions = computed(() => [
    connectAction,
    { id: 'syncAll', label: 'Sync all', priority: 'secondary' as const, onSelect: syncAll },
    ...(list.value.some((connection) => connection.source === 'live') && hasNonLiveData.value
      ? [{ id: 'liveOnly', label: 'Start fresh with live data', priority: 'tertiary' as const, destructive: true, onSelect: switchToLiveData }]
      : []),
  ]);

  return Page({
    title: 'Banks',
    status: items,
    actions: pageActions,
    children: computed(() => [
      Grid({
        children: [
          Stat({ label: 'Connected banks', value: String(list.value.length), status: items }),
          Stat({ label: 'Linked accounts', value: String(list.value.reduce((s, i) => s + i.accounts.length, 0)), status: items }),
          Stat({ label: 'Last sync', value: relative(newest.value), hint: newest.value ? new Date(newest.value).toLocaleString() : 'Nothing synced yet' }),
          Stat({
            label: 'Ledger data',
            value: computed(() => hasNonLiveData.value ? 'Mixed' : list.value.some((connection) => connection.source === 'live') ? 'Live only' : 'Local / simulated'),
            hint: computed(() => {
              const value = composition.data.value;
              if (!value) return 'Checking provenance…';
              return `${value.transactions.live} live · ${value.transactions.simulated} simulated · ${value.transactions.unowned} local/imported transactions · ${value.history} prior provider changes retained`;
            }),
            status: composition,
          }),
        ],
      }),
      ...(items.data.value && list.value.length === 0
        ? [Empty({ title: 'No banks connected', hint: 'Connect a bank to pull transactions automatically. Chase connects through Plaid; your credentials never touch this app.', action: connectAction })]
        : [Section({
            title: 'Connections',
            status: items,
            children: [Table<BankConnection>({ columns, rows: list, key: (i) => i.id, onSelect: (i) => { selected.value = i; open.value = true; }, empty: 'No banks connected.' })],
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
          Text({ text: `${selected.value.source === 'live' ? `${selected.value.provider} ${selected.value.environment}` : 'Simulated connection'} · Last sync ${relative(lastSync.value[selected.value.id]?.at)} · ${importedFor(selected.value.id)} imported`, role: 'muted' }),
          ...(selected.value.error ? [Text({ text: `${selected.value.error.code}: ${selected.value.error.message}`, role: 'muted' })] : []),
          Table<BankAccount>({ columns: accountColumns, rows: selected.value.accounts, key: (a) => a.id }),
          Form<Record<string, never>>({
            fields: [],
            value: {},
            onSubmit: async () => {
              if (selected.value!.status === 'reauth-required') {
                await launchLink(selected.value!.id);
                close();
                return;
              }
              const r = await syncOne(selected.value!);
              notify(`Synced ${r.added} new${r.unmatched ? `, ${r.unmatched} unmatched` : ''}${r.removed ? `, ${r.removed} removed` : ''}`, 'positive');
            },
            submitLabel: selected.value.status === 'reauth-required' ? 'Reconnect' : 'Sync now',
            onCancel: close,
            destructive: {
              id: 'disconnect',
              label: 'Disconnect',
              destructive: true,
              onSelect: async () => {
                const item = selected.value!;
                if (await confirm({ title: `Disconnect ${item.institution}?`, message: 'Imported transactions stay; the bank link is removed.', destructive: true, confirmLabel: 'Disconnect' })) {
                  await flushNow();
                  await disconnectConnection(item.id);
                  await Promise.all([items.refetch(), composition.refetch()]);
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
