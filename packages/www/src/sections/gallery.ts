/**
 * sections/gallery.ts — the @nisli/ui second beat: "batteries included".
 * Live, SSG-rendered @nisli/ui components teasing the full gallery at /ui.
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button, buttonVariants } from '../nisli-ui/ui/button.js';
import { Badge } from '../nisli-ui/ui/badge.js';
import { Switch } from '../nisli-ui/ui/switch.js';
import { Checkbox } from '../nisli-ui/ui/checkbox.js';
import { Input } from '../nisli-ui/ui/input.js';
import { Label } from '../nisli-ui/ui/label.js';

function Demo(title: string, body: TemplateResult): TemplateResult {
  return html`<div class="flex flex-col gap-3 rounded-lg border bg-card p-5">
    <span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">${title}</span>
    <div class="flex flex-1 flex-wrap items-center gap-3">${body}</div>
  </div>`;
}

export function gallery(): TemplateResult {
  return html`<section id="gallery" class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
    <div class="max-w-2xl">
      <div class="text-sm font-medium text-muted-foreground">Batteries included</div>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight text-balance">
        A component library you own
      </h2>
      <p class="mt-3 text-lg text-muted-foreground text-pretty">
        <span class="text-foreground">@nisli/ui</span> is nisli's design language —
        shadcn-style components, ported to nisli, copied into your project as source
        you control. Every component below is real @nisli/ui, rendered to static HTML
        by @nisli/ssg.
      </p>
    </div>

    <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${Demo(
        'Buttons',
        html`${Button({ children: 'Default' })} ${Button({ variant: 'secondary', children: 'Secondary' })}
        ${Button({ variant: 'outline', children: 'Outline' })}
        ${Button({ variant: 'destructive', children: 'Destructive' })}`,
      )}
      ${Demo(
        'Badges',
        html`${Badge({ children: 'Default' })} ${Badge({ variant: 'secondary', children: 'Secondary' })}
        ${Badge({ variant: 'outline', children: 'Outline' })}
        ${Badge({ variant: 'destructive', children: 'Destructive' })}`,
      )}
      ${Demo(
        'Toggles',
        html`<span class="flex items-center gap-2">${Switch({ checked: true })}
          ${Label({ children: 'Wi-Fi' })}</span>
        <span class="flex items-center gap-2">${Checkbox({ checked: true })}
          ${Label({ children: 'Accept' })}</span>`,
      )}
      ${Demo(
        'Inputs',
        html`<div class="grid w-full gap-2">
          ${Label({ children: 'Email' })}
          ${Input({ type: 'email', placeholder: 'you@nisli.dev' })}
        </div>`,
      )}
    </div>

    <div class="mt-8">
      <a href="/ui" class="${buttonVariants({ variant: 'outline' })}">Browse all components →</a>
    </div>
  </section>`;
}
