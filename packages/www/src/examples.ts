/**
 * examples.ts — curated live previews for /ui/<component> pages.
 * Optional by design: a component with no entry here still gets a full page
 * (description, add command, dependencies) — the preview is just omitted.
 * Every preview is real @nisli/ui, rendered to static HTML by @nisli/ssg in an
 * SSG-safe state (interactive components show their resting/trigger state).
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button } from './nisli-ui/ui/button.js';
import { Badge } from './nisli-ui/ui/badge.js';
import { Label } from './nisli-ui/ui/label.js';
import { Input } from './nisli-ui/ui/input.js';
import { Textarea } from './nisli-ui/ui/textarea.js';
import { Checkbox } from './nisli-ui/ui/checkbox.js';
import { Switch } from './nisli-ui/ui/switch.js';
import { Separator } from './nisli-ui/ui/separator.js';
import { Skeleton } from './nisli-ui/ui/skeleton.js';
import { Progress } from './nisli-ui/ui/progress.js';
import { Slider } from './nisli-ui/ui/slider.js';
import { Kbd } from './nisli-ui/ui/kbd.js';
import { Spinner } from './nisli-ui/ui/spinner.js';
import { Alert, AlertTitle, AlertDescription } from './nisli-ui/ui/alert.js';
import { Avatar, AvatarFallback } from './nisli-ui/ui/avatar.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from './nisli-ui/ui/card.js';

export const examples: Record<string, () => TemplateResult> = {
  button: () =>
    html`<div class="flex flex-wrap items-center gap-3">
      ${Button({ children: 'Default' })} ${Button({ variant: 'secondary', children: 'Secondary' })}
      ${Button({ variant: 'outline', children: 'Outline' })}
      ${Button({ variant: 'destructive', children: 'Destructive' })}
      ${Button({ variant: 'ghost', children: 'Ghost' })} ${Button({ variant: 'link', children: 'Link' })}
    </div>`,
  badge: () =>
    html`<div class="flex flex-wrap items-center gap-3">
      ${Badge({ children: 'Default' })} ${Badge({ variant: 'secondary', children: 'Secondary' })}
      ${Badge({ variant: 'outline', children: 'Outline' })}
      ${Badge({ variant: 'destructive', children: 'Destructive' })}
    </div>`,
  label: () => html`${Label({ children: 'Your email address' })}`,
  input: () => html`<div class="grid w-full max-w-sm gap-2">
    ${Label({ children: 'Email' })}${Input({ type: 'email', placeholder: 'you@nisli.dev' })}
  </div>`,
  textarea: () =>
    html`<div class="grid w-full max-w-sm gap-2">
      ${Label({ children: 'Message' })}${Textarea({ placeholder: 'Type your message…', rows: 3 })}
    </div>`,
  checkbox: () =>
    html`<div class="flex items-center gap-2">${Checkbox({ checked: true })}${Label({ children: 'Accept terms' })}</div>`,
  switch: () =>
    html`<div class="flex items-center gap-2">${Switch({ checked: true })}${Label({ children: 'Airplane mode' })}</div>`,
  separator: () =>
    html`<div class="w-full max-w-sm">
      <p class="text-sm">Above</p>
      <div class="my-3">${Separator({})}</div>
      <p class="text-sm">Below</p>
    </div>`,
  skeleton: () =>
    html`<div class="flex items-center gap-4">
      ${Skeleton({ className: 'h-12 w-12 rounded-full' })}
      <div class="grid gap-2">
        ${Skeleton({ className: 'h-4 w-[200px]' })}${Skeleton({ className: 'h-4 w-[160px]' })}
      </div>
    </div>`,
  progress: () => html`<div class="w-full max-w-sm">${Progress({ value: 62 })}</div>`,
  slider: () => html`<div class="w-full max-w-sm">${Slider({ defaultValue: 50 })}</div>`,
  kbd: () =>
    html`<div class="flex items-center gap-2">${Kbd({ children: '⌘' })}${Kbd({ children: 'K' })}</div>`,
  spinner: () => html`${Spinner({})}`,
  alert: () =>
    html`<div class="w-full max-w-md">
      ${Alert({
        children: html`${AlertTitle({ children: 'Heads up!' })}
        ${AlertDescription({ children: 'You can copy this component into your project and own it.' })}`,
      })}
    </div>`,
  avatar: () => html`${Avatar({ children: AvatarFallback({ children: 'NS' }) })}`,
  card: () =>
    html`<div class="w-full max-w-sm">
      ${Card({
        children: html`${CardHeader({
          children: html`${CardTitle({ children: 'Create project' })}
          ${CardDescription({ children: 'Deploy your new project in one click.' })}`,
        })}
        ${CardContent({ children: html`<p class="text-sm text-muted-foreground">Card body content.</p>` })}`,
      })}
    </div>`,
};

export function getExample(name: string): (() => TemplateResult) | undefined {
  return examples[name];
}
