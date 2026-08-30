#!/usr/bin/env node
/** Install or remove Ledger's per-user macOS LaunchAgent. */
import { access, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const LABEL = 'dev.nisli.ledger';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, '.env');
const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const DOMAIN = `gui/${process.getuid()}`;
const target = `${DOMAIN}/${LABEL}`;
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });

async function remove() {
  launchctl('bootout', target);
  await unlink(PLIST).catch(() => {});
  console.log(`Removed ${LABEL}`);
}

async function install() {
  await access(join(ROOT, 'dev', 'dist', 'index.html')).catch(() => { throw new Error('Build Ledger before installing the service.'); });
  const env = await readFile(ENV_FILE, 'utf8').catch(() => { throw new Error(`Create ${ENV_FILE} from .env.example first.`); });
  const envMode = (await stat(ENV_FILE)).mode & 0o777;
  if ((envMode & 0o077) !== 0) throw new Error('.env must not be readable by group or other users; run chmod 600 .env');
  for (const name of ['PLAID_CLIENT_ID', 'PLAID_SECRET']) {
    if (!new RegExp(`^${name}=.+$`, 'm').test(env)) throw new Error(`${name} is missing from .env`);
  }
  if (!/^LEDGER_KEY=[0-9a-fA-F]{64}$/m.test(env)) throw new Error('LEDGER_KEY in .env must be exactly 64 hexadecimal characters');
  const logDir = join(ROOT, 'server', 'data');
  await mkdir(dirname(PLIST), { recursive: true });
  await mkdir(logDir, { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${xml(process.execPath)}</string>
    <string>--env-file-if-exists=${xml(ENV_FILE)}</string>
    <string>${xml(join(ROOT, 'server', 'index.mjs'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>production</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(join(logDir, 'server.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logDir, 'server.error.log'))}</string>
</dict></plist>\n`;
  launchctl('bootout', target);
  await writeFile(PLIST, plist, { mode: 0o600 });
  const loaded = launchctl('bootstrap', DOMAIN, PLIST);
  if (loaded.status !== 0) throw new Error(loaded.stderr.trim() || 'launchctl bootstrap failed');
  launchctl('kickstart', '-k', target);
  console.log(`Installed ${LABEL}; Ledger will start at login and stay running.`);
}

const command = process.argv[2];
if (command === 'install') await install();
else if (command === 'remove') await remove();
else throw new Error('Usage: node scripts/service.mjs install|remove');
