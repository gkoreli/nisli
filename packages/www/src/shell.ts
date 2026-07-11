/**
 * shell.ts — full HTML document around a rendered page fragment.
 * Static CSS (dist/assets/site.css, compiled by Tailwind CLI), dark mode via
 * a .dark class persisted in localStorage, no runtime JS beyond the toggle.
 */
export function shell(fragment: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>nisli — reactive web components, shadcn-style UI you own</title>
<meta name="description" content="nisli is a reactive web-component framework; @nisli/ui is its shadcn-style component library, installed as source you own." />
<link rel="stylesheet" href="./assets/site.css" />
<script>try{if(localStorage.theme==='dark'||(!('theme' in localStorage)&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}</script>
</head>
<body>
<div class="fixed top-4 right-4 z-[200]">
  <button id="theme-toggle" aria-label="Toggle dark mode" class="rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs hover:bg-accent">
    Theme
  </button>
</div>
${fragment}
<script>
document.getElementById('theme-toggle').addEventListener('click',()=>{
  const dark=document.documentElement.classList.toggle('dark');
  try{localStorage.theme=dark?'dark':'light'}catch(e){}
});
</script>
</body>
</html>
`;
}
