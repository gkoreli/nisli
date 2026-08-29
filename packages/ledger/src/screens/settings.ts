import { component, signal, computed, query } from '@nisli/core';
import { Page, Section, Form, Text, Dialog, Stat, Table, confirm, notify, type Field, type Column } from '@nisli/engine';
import type { Settings } from '../data/model.js';
import { settings, saveSettings, resetToSeed, exportBackup, importBackup, syncState, lastSavedAt, applyRestored } from '../data/store.js';
import { listBackups, restoreBackup } from '../data/api.js';
import { today } from '../data/format.js';

type BackupDraft = { file: File | undefined };
type ServerBackup = { name: string; date: string; bytes: number };

const relative = (iso: string | undefined): string => {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const SYNC_WORDS = {
  saved: 'Saved to your Mac',
  saving: 'Saving…',
  offline: 'Offline — changes are kept and will sync',
  conflict: 'Reloaded from the server',
} as const;

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
const backupDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export const SettingsScreen = component('ledger-settings', () => {
  const draft = signal<Settings>({ ...settings.value });
  const importing = signal(false);
  const backup = signal<BackupDraft>({ file: undefined });
  const fields: Field<Settings>[] = [
    { key: 'name', label: 'Your name', kind: 'text', required: true },
    { key: 'currency', label: 'Currency', kind: 'select', required: true, options: ['USD', 'EUR', 'GBP', 'GEL', 'JPY'].map((c) => ({ value: c, label: c })) },
    { key: 'locale', label: 'Number format', kind: 'select', required: true, options: [{ value: 'en-US', label: 'English (US)' }, { value: 'en-GB', label: 'English (UK)' }, { value: 'de-DE', label: 'Deutsch' }, { value: 'ka-GE', label: 'ქართული' }] },
    { key: 'appearance', label: 'Appearance', kind: 'select', required: true, options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
  ];
  const backups = query(() => ['ledger', 'backups'], () => listBackups());
  const backupRows = computed<ServerBackup[]>(() => backups.data.value ?? []);
  const chosen = signal<ServerBackup | undefined>(undefined);
  const restoring = signal(false);
  const backupColumns: Column<ServerBackup>[] = [
    { id: 'date', header: 'Date', kind: 'date', cell: (b) => backupDate(b.date), priority: 'primary' },
    { id: 'size', header: 'Size', kind: 'number', cell: (b) => kilobytes(b.bytes) },
    { id: 'name', header: 'Name', cell: (b) => b.name, priority: 'tertiary' },
  ];
  const restoreFromServer = async () => {
    const b = chosen.value;
    if (!b) return;
    try {
      const { ledger, version } = await restoreBackup(b.name);
      applyRestored(ledger, version);
      draft.value = { ...settings.value };
      restoring.value = false;
      notify(`Restored backup from ${backupDate(b.date)}`, 'positive');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not restore that backup.', 'negative');
    }
  };
  const backupFields: Field<BackupDraft>[] = [
    { key: 'file', label: 'Backup file', kind: 'file', accept: '.json,application/json', required: true, hint: 'A file exported from Ledger. It replaces everything currently stored.' },
  ];

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Backup downloaded', 'positive');
  };

  const restore = async (d: BackupDraft) => {
    try {
      const next = importBackup(await d.file!.text());
      draft.value = { ...next.settings };
      importing.value = false;
      notify(`Restored ${next.transactions.length} transactions`, 'positive');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that file.', 'negative');
    }
  };

  return Page({
    title: 'Settings',
    actions: [
      { id: 'export', label: 'Export backup', priority: 'secondary', onSelect: download },
      { id: 'import', label: 'Import backup', priority: 'tertiary', onSelect: () => { backup.value = { file: undefined }; importing.value = true; } },
      { id: 'reset', label: 'Reset demo data', priority: 'tertiary', destructive: true, onSelect: async () => {
        if (!(await confirm({ title: 'Reset all data?', message: 'This replaces everything with the demo data. Export a backup first if you need it.', confirmLabel: 'Reset', destructive: true }))) return;
        resetToSeed(); draft.value = { ...settings.value }; notify('Demo data restored');
      } },
    ],
    children: [
      Section({
        title: 'Preferences',
        children: [
          Form<Settings>({ fields, value: draft, onChange: (v) => { draft.value = v; }, onSubmit: (v) => { saveSettings(v); notify('Preferences saved', 'positive'); }, submitLabel: 'Save preferences' }),
        ],
      }),
      Section({ title: 'Appearance', children: [Text({ text: 'System follows your device. The engine switches the whole app, including native controls.', role: 'muted' })] }),
      Section({
        title: 'Data',
        children: computed(() => [
          Stat({ label: 'Last saved', value: relative(lastSavedAt.value), hint: SYNC_WORDS[syncState.value] }),
          Table<ServerBackup>({
            columns: backupColumns,
            rows: backupRows,
            key: (b) => b.name,
            status: backups,
            onSelect: (b) => { chosen.value = b; restoring.value = true; },
            empty: 'No backups yet. The first one is written tonight.',
          }),
          Text({ text: 'Backups are written on the Mac daily, under server/data/backups. Restoring replaces what is stored now with that day’s copy; export a backup first if you want to keep today.', role: 'muted' }),
        ]),
      }),
      Section({ title: 'About', children: [Text({ text: 'Ledger keeps everything in this browser. Nothing leaves your device. Export a backup to keep a copy.', role: 'muted' })] }),
      Dialog({
        title: 'Restore this backup?',
        open: restoring,
        onClose: () => { restoring.value = false; },
        children: computed(() => [
          Text({ text: chosen.value ? `From ${backupDate(chosen.value.date)} (${kilobytes(chosen.value.bytes)}). Everything stored now is replaced.` : '', role: 'muted' }),
          Form<Record<string, never>>({ fields: [], value: {}, onChange: () => {}, onSubmit: restoreFromServer, submitLabel: 'Restore', onCancel: () => { restoring.value = false; } }),
        ]),
      }),
      Dialog({
        title: 'Import backup',
        open: importing,
        onClose: () => { importing.value = false; },
        children: [
          Form<BackupDraft>({ fields: backupFields, value: backup, onChange: (v) => { backup.value = v; }, onSubmit: restore, submitLabel: 'Restore', onCancel: () => { importing.value = false; } }),
        ],
      }),
    ],
  });
});
