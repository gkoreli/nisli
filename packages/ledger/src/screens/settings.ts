import { component, signal } from '@nisli/core';
import { Page, Section, Form, Text, Dialog, confirm, notify, type Field } from '@nisli/engine';
import type { Settings } from '../data/model.js';
import { settings, saveSettings, resetToSeed, exportBackup, importBackup } from '../data/store.js';
import { today } from '../data/format.js';

type BackupDraft = { file: File | undefined };

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
      Section({ title: 'About', children: [Text({ text: 'Ledger keeps everything in this browser. Nothing leaves your device. Export a backup to keep a copy.', role: 'muted' })] }),
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
