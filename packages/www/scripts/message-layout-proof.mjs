/** Built-site Chromium proof for UI-67 Message header and inline-code layout. */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const wwwDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(wwwDir, 'dist');

function closeServer(server) {
  return new Promise((resolve, reject) => {
    let closeInvocationError;
    let closeCallbackError;
    let closeCallbackRan = false;
    let connectionError;
    let connectionAttemptRan = false;

    const settle = () => {
      if (!connectionAttemptRan || (!closeInvocationError && !closeCallbackRan)) return;
      // Ownership precedence: failure to invoke the graceful close is primary,
      // then its callback error, then forced-connection cleanup.
      const failure = closeInvocationError ?? closeCallbackError ?? connectionError;
      if (failure) reject(failure);
      else resolve();
    };

    try {
      server.close((error) => {
        closeCallbackRan = true;
        closeCallbackError = error;
        settle();
      });
    } catch (error) {
      closeInvocationError = error;
    }
    try {
      server.closeAllConnections?.();
    } catch (error) {
      connectionError = error;
    }
    connectionAttemptRan = true;
    settle();
  });
}

async function cleanupResources({ browser, server, primary }) {
  const failures = [];
  for (const close of [
    () => browser?.close(),
    () => server && closeServer(server),
  ]) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (!primary && failures.length) throw failures[0];
}

async function selfTestCleanup() {
  const primary = new Error('injected primary message-layout failure');
  const browserFailure = new Error('injected browser cleanup failure');
  const serverFailure = new Error('injected server cleanup failure');
  const connectionFailure = new Error('injected connection cleanup failure');
  const attempts = [];
  let caughtPrimary;
  try {
    try {
      throw primary;
    } catch (error) {
      throw error;
    } finally {
      await cleanupResources({
        browser: { close: () => { attempts.push('browser'); throw browserFailure; } },
        server: {
          close: (done) => { attempts.push('server'); done(serverFailure); },
          closeAllConnections: () => attempts.push('connections'),
        },
        primary,
      });
    }
  } catch (error) {
    caughtPrimary = error;
  }

  let browserSettled = false;
  let caughtCleanup;
  try {
    await cleanupResources({
      browser: { close: async () => { await Promise.resolve(); browserSettled = true; } },
      server: {
        close: (done) => {
          if (!browserSettled) throw new Error('server closed before browser settled');
          done(serverFailure);
        },
        closeAllConnections: () => {},
      },
    });
  } catch (error) {
    caughtCleanup = error;
  }

  const syncServerAttempts = [];
  let caughtSyncServerCleanup;
  try {
    await cleanupResources({
      browser: { close: async () => syncServerAttempts.push('browser') },
      server: {
        close: () => {
          syncServerAttempts.push('server');
          throw serverFailure;
        },
        closeAllConnections: () => {
          syncServerAttempts.push('connections');
          throw connectionFailure;
        },
      },
    });
  } catch (error) {
    caughtSyncServerCleanup = error;
  }

  if (
    caughtPrimary !== primary ||
    caughtCleanup !== serverFailure ||
    caughtSyncServerCleanup !== serverFailure
  ) {
    throw new Error('UI-67 cleanup self-test lost primary precedence or cleanup-only surfacing');
  }
  if (attempts.join(',') !== 'browser,server,connections') {
    throw new Error(`UI-67 cleanup self-test skipped a resource: ${attempts.join(',')}`);
  }
  if (syncServerAttempts.join(',') !== 'browser,server,connections') {
    throw new Error(`UI-67 sync server-close mutation skipped cleanup: ${syncServerAttempts.join(',')}`);
  }
  console.log('UI-67 cleanup self-test OK: ordered awaits, all-attempt cleanup, primary precedence');
}

if (process.argv.includes('--self-test-cleanup')) {
  await selfTestCleanup();
  process.exit(0);
}

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    let file = normalize(join(distDir, relative));
    if (!file.startsWith(distDir)) throw new Error('invalid path');
    const info = await stat(file).catch(() => undefined);
    if (!info || info.isDirectory()) file = join(file, 'index.html');
    response.setHeader('content-type', contentTypes[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).on('error', () => {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    }).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

let browser;
let primary;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('UI-67 proof server has no TCP address');
  browser = await chromium.launch();
  const page = await browser.newPage();
  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto(`http://127.0.0.1:${address.port}/ui/message/`, { waitUntil: 'networkidle' });
    await page.locator('[data-preview="message"][data-hydrated="true"]').waitFor();
    const result = await page.evaluate(() => {
      const headers = [...document.querySelectorAll('[data-slot="message-header"]')];
      const sentence = document.querySelector('[data-message-sentence]');
      const code = sentence?.querySelector('code');
      const period = document.querySelector('[data-message-period]');
      if (!headers.length || !sentence || !code || !period) throw new Error('Message proof fixture is incomplete');
      const headerGaps = headers.map((header) => parseFloat(getComputedStyle(header).columnGap));
      const codeRects = [...code.getClientRects()];
      const codeRect = codeRects.at(-1) ?? code.getBoundingClientRect();
      const periodRect = period.getBoundingClientRect();
      const pre = document.createElement('pre');
      const blockCode = document.createElement('code');
      blockCode.textContent = 'const preserved = true';
      pre.append(blockCode);
      sentence.parentElement.append(pre);
      const preRect = pre.getBoundingClientRect();
      return {
        headerGaps,
        codeDisplay: getComputedStyle(code).display,
        sentenceDisplay: getComputedStyle(sentence).display,
        periodSharesLineBox: periodRect.top < codeRect.bottom && codeRect.top < periodRect.bottom,
        periodFollowsCode: periodRect.left >= codeRect.right - 1,
        preDisplay: getComputedStyle(pre).display,
        preAfterSentence: preRect.top >= sentence.getBoundingClientRect().bottom,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    if (result.headerGaps.some((gap) => !(gap > 0))) {
      throw new Error(`Message header gap is zero at ${width}px: ${JSON.stringify(result)}`);
    }
    if (result.codeDisplay !== 'inline' || !result.periodSharesLineBox || !result.periodFollowsCode) {
      throw new Error(`Message sentence is discontinuous at ${width}px: ${JSON.stringify(result)}`);
    }
    if (result.preDisplay !== 'block' || !result.preAfterSentence || result.overflow) {
      throw new Error(`Message block-code control changed at ${width}px: ${JSON.stringify(result)}`);
    }
    console.log(`UI-67 ${width}px: ${JSON.stringify(result)}`);
  }
  if (runtimeErrors.length) throw new Error(`UI-67 browser errors: ${runtimeErrors.join('; ')}`);
  console.log('UI-67 Message layout proof OK at 1280px and 390px');
} catch (error) {
  primary = error;
  throw error;
} finally {
  await cleanupResources({ browser, server, primary });
}
