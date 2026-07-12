/**
 * shell.ts — the outer HTML document around a rendered body fragment.
 * Per-page <title>/description, static CSS (dist/assets/site.css, compiled by
 * the Tailwind CLI), dark mode via a `.dark` class persisted in localStorage.
 * No client bundle — the only JS is inline progressive enhancement (the theme
 * toggle and the code copy-to-clipboard). The body fragment (nav + main + footer)
 * is a nisli template rendered by @nisli/ssg; this wrapper stays a string
 * because a full <!doctype html> document can't be mounted into a DOM host.
 * Asset/link paths are absolute (`/assets/...`) so they resolve from nested
 * routes like `/docs/signals/` too.
 */
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

export function shell(bodyFragment: string, meta: ShellMeta): string {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="stylesheet" href="/assets/site.css" />
<script>try{if(localStorage.theme==='dark'||(!('theme' in localStorage)&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}</script>
</head>
<body class="bg-background text-foreground antialiased">
${bodyFragment}
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
</script>
</body>
</html>
`;
}
