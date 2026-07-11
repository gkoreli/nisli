/**
 * shell.ts — the outer HTML document around a rendered body fragment.
 * Per-page <title>/description, static CSS (dist/assets/site.css, compiled by
 * the Tailwind CLI), dark mode via a `.dark` class persisted in localStorage,
 * no runtime JS beyond the theme toggle. The body fragment (nav + main + footer)
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
</script>
</body>
</html>
`;
}
