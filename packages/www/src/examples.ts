/**
 * examples.ts — curated live previews for /ui/<component> pages.
 * These are the OVERRIDE path (WWW-6): a component listed here renders this
 * hand-authored composition; a component NOT listed here still gets a live
 * preview, auto-generated from its registry entry (see preview.ts). Curate an
 * entry when the auto-default renders sparse (compositional components) or when
 * a richer example tells the story better. Every preview is real @nisli/ui,
 * rendered to static HTML by @nisli/ssg in an SSG-safe state (interactive
 * components show their resting/trigger state).
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
import { buttonVariants } from './nisli-ui/ui/button.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './nisli-ui/ui/tabs.js';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './nisli-ui/ui/accordion.js';
import { Select } from './nisli-ui/ui/select.js';
import { RadioGroup, RadioGroupItem } from './nisli-ui/ui/radio-group.js';
import { ToggleGroup, ToggleGroupItem } from './nisli-ui/ui/toggle-group.js';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './nisli-ui/ui/breadcrumb.js';
import { Tooltip, TooltipTrigger, TooltipContent } from './nisli-ui/ui/tooltip.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationLink,
  PaginationEllipsis,
  PaginationNext,
} from './nisli-ui/ui/pagination.js';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './nisli-ui/ui/dialog.js';

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
  tabs: () =>
    html`<div class="w-full max-w-sm">
      ${Tabs({
        defaultValue: 'account',
        children: html`${TabsList({
          children: html`${TabsTrigger({ value: 'account', children: 'Account' })}
          ${TabsTrigger({ value: 'password', children: 'Password' })}`,
        })}
        ${TabsContent({ value: 'account', children: 'Account settings live here.' })}
        ${TabsContent({ value: 'password', children: 'Change your password here.' })}`,
      })}
    </div>`,
  accordion: () =>
    html`<div class="w-full max-w-md">
      ${Accordion({
        type: 'single',
        collapsible: true,
        children: html`${AccordionItem({
          value: 'a11y',
          children: html`${AccordionTrigger({ children: 'Is it accessible?' })}
          ${AccordionContent({ children: 'Yes. It follows the WAI-ARIA accordion pattern.' })}`,
        })}
        ${AccordionItem({
          value: 'own',
          children: html`${AccordionTrigger({ children: 'Do I own the code?' })}
          ${AccordionContent({ children: 'Yes. nisli-ui add copies the source into your project.' })}`,
        })}`,
      })}
    </div>`,
  select: () =>
    html`${Select({
      name: 'fruit',
      defaultValue: 'apple',
      className: 'w-56',
      children: html`<option value="apple">Apple</option>
        <option value="banana">Banana</option>
        <option value="pear">Pear</option>`,
    })}`,
  'radio-group': () =>
    html`${RadioGroup({
      name: 'plan',
      defaultValue: 'pro',
      children: html`<div class="flex items-center gap-2">
          ${RadioGroupItem({ value: 'free', id: 'plan-free' })}${Label({ htmlFor: 'plan-free', children: 'Free' })}
        </div>
        <div class="flex items-center gap-2">
          ${RadioGroupItem({ value: 'pro', id: 'plan-pro' })}${Label({ htmlFor: 'plan-pro', children: 'Pro' })}
        </div>`,
    })}`,
  'toggle-group': () =>
    html`${ToggleGroup({
      type: 'single',
      variant: 'outline',
      defaultValue: 'center',
      children: html`${ToggleGroupItem({ value: 'left', children: 'Left' })}
      ${ToggleGroupItem({ value: 'center', children: 'Center' })}
      ${ToggleGroupItem({ value: 'right', children: 'Right' })}`,
    })}`,
  breadcrumb: () =>
    // Salvaged from packages/ui/demo/site.ts; the middle link points at /ui
    // (this site's components route) instead of the demo's /components — a
    // deliberate site adaptation, approved in the WWW-6 review.
    html`${Breadcrumb({
      children: BreadcrumbList({
        children: html`${BreadcrumbItem({ children: BreadcrumbLink({ href: '/', children: 'Home' }) })}${BreadcrumbSeparator({})}
        ${BreadcrumbItem({ children: BreadcrumbLink({ href: '/ui', children: 'Components' }) })}${BreadcrumbSeparator({})}
        ${BreadcrumbItem({ children: BreadcrumbPage({ children: 'Breadcrumb' }) })}`,
      }),
    })}`,
  tooltip: () =>
    html`${Tooltip({
      children: html`${TooltipTrigger({
        className: buttonVariants({ variant: 'outline' }),
        children: 'Hover me',
      })}
      ${TooltipContent({ children: 'Rendered statically; opens on hover.' })}`,
    })}`,
  pagination: () =>
    html`${Pagination({
      children: PaginationContent({
        children: html`${PaginationItem({ children: PaginationPrevious({ href: '#' }) })}
        ${PaginationItem({ children: PaginationLink({ href: '#', children: '1' }) })}
        ${PaginationItem({ children: PaginationLink({ href: '#', isActive: true, children: '2' }) })}
        ${PaginationItem({ children: PaginationLink({ href: '#', children: '3' }) })}
        ${PaginationItem({ children: PaginationEllipsis({}) })}
        ${PaginationItem({ children: PaginationNext({ href: '#' }) })}`,
      }),
    })}`,
  dialog: () =>
    html`${Dialog({
      children: html`${DialogTrigger({
        className: buttonVariants({ variant: 'outline' }),
        children: 'Open Dialog',
      })}
      ${DialogContent({
        children: html`${DialogHeader({
          children: html`${DialogTitle({ children: 'Edit profile' })}
          ${DialogDescription({
            children: "Make changes to your profile here. Click save when you're done.",
          })}`,
        })}
        ${DialogFooter({
          children: html`${Button({ variant: 'outline', children: 'Cancel' })}
          ${Button({ children: 'Save changes' })}`,
        })}`,
      })}`,
    })}`,
};

export function getExample(name: string): (() => TemplateResult) | undefined {
  return examples[name];
}
