/**
 * shell.ts — the outer HTML document around a rendered body fragment.
 * Per-page <title>/description, static CSS (dist/assets/site.css, compiled by
 * the Tailwind CLI), dark mode via a `.dark` class persisted in localStorage.
 * Baseline JS is inline progressive enhancement (the theme toggle and the code
 * copy-to-clipboard). Additionally, /ui pages whose component has an interactive
 * example inject the WWW-10 hydration bundle (/ui-preview/hydrate.js) via the
 * `hydrate` option — the only external client bundle, and still strictly
 * progressive (the static preview is the no-JS baseline). The body fragment
 * (nav + main + footer) is a nisli template rendered by @nisli/ssg; this stays a string
 * because a full <!doctype html> document can't be mounted into a DOM host.
 * Asset/link paths are absolute (`/assets/...`) so they resolve from nested
 * routes like `/docs/signals/` too.
 */
import { renderViewTransitionHead } from '@nisli/ssg';

/**
 * Cross-document view transitions + speculation rules (BET04), emitted by the
 * SSG's own emitter so the bytes match a `viewTransitions:`-configured build
 * exactly. It is assembled HERE rather than passed to `buildStaticSite` because
 * this site's `shell` callback returns a body FRAGMENT: the build option injects
 * before the first `</head>` of what it is given, and a fragment has none, so
 * that build now fails closed instead of emitting the block where this function
 * would wrap it into `<body>`. `@nisli/ssg` exports the emitter for precisely
 * this shape.
 *
 * A cross-document transition needs BOTH documents opted in, which is why this
 * is unconditional across every built page rather than per-page authoring.
 *
 * Speculation rules: PREFETCH only, at the default `moderate` eagerness and the
 * default `/*` scope — the whole site is static, same-origin GET documents, so
 * fetching one on hover is free of consequence and removes the round trip that
 * actually costs a reader time.
 *
 * Prerender is declined, and NOT for safety: the prerender audit came back
 * clean (the two inline scripts below are a paint decision and pure listener
 * wiring, and the preview runtime only wires and mounts islands — see the
 * comment at each). It is declined on cost, because of what `moderate` means
 * on THIS site. Moderate fires on hover, and the docs sidebar is a dense list
 * of ~50 links a reader's pointer sweeps across while scanning. Prefetch pays
 * for that sweep with a cached HTTP response; prerender pays for it by running
 * the whole page — including the preview runtime, which downloads the examples
 * chunk and mounts every island — for a page the reader never opens. The saving
 * bought is parse plus hydrate on documents whose visible content is already
 * painted static HTML. Flipping this to `{ speculationRules: true }` is the
 * one-line change if that trade ever inverts.
 */
const viewTransitionHead = renderViewTransitionHead({
  speculationRules: { prerender: false },
});

export interface ShellMeta {
  title: string;
  description: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface ShellOptions {
  /** Inject the WWW-10 preview hydration runtime (only /ui pages that hydrate). */
  hydrate?: boolean;
}

export function shell(bodyFragment: string, meta: ShellMeta, options: ShellOptions = {}): string {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const hydrateScript = options.hydrate
    ? '\n<script type="module" src="/ui-preview/hydrate.js"></script>'
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="stylesheet" href="/assets/site.css" />
${viewTransitionHead}
<!-- Prerender-safe eagerly: the theme class is a PAINT decision that has to be
     settled before the activation frame, not an observable side effect. -->
<script>try{if(localStorage.theme==='dark'||(!('theme' in localStorage)&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}</script>
</head>
<body class="bg-background text-foreground antialiased">
${bodyFragment}
<!-- Prerender-safe eagerly: pure listener wiring. Neither handler can fire in a
     prerendering document (there is no user to click in it), and nothing here
     runs at parse time, so no whenActive() guard is warranted. The same holds
     for the preview hydration module below: it only wires and mounts islands. -->
<script>
document.getElementById('theme-toggle')?.addEventListener('click',()=>{
  const dark=document.documentElement.classList.toggle('dark');
  try{localStorage.theme=dark?'dark':'light'}catch(e){}
});
document.querySelectorAll('[data-copy]').forEach((btn)=>{
  btn.addEventListener('click',async()=>{
    const code=btn.closest('[data-code-block]')?.querySelector('code')?.textContent||'';
    try{await navigator.clipboard.writeText(code);
      const idle=btn.querySelector('[data-copy-idle]'),done=btn.querySelector('[data-copy-done]');
      if(idle&&done){idle.hidden=true;done.hidden=false;setTimeout(()=>{idle.hidden=false;done.hidden=true},1200);}
    }catch(e){}
  });
});
</script>${hydrateScript}
</body>
</html>
`;
}
