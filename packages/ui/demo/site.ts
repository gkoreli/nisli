/**
 * demo/site.ts — the @nisli/ui kitchen-sink demo page.
 *
 * A real consumer of the library: every component below is imported from
 * demo/src/nisli-ui/, which is CLI output (`pnpm --filter @nisli/ui
 * demo:sync`), and the page is rendered to static HTML with @nisli/ssg —
 * the registry → `add` → import → render pipeline end to end (the
 * NORTH-STAR dogfood milestone).
 */

import { html, type TemplateResult } from '@nisli/core';
import { buildStaticSite, type StaticSiteBuildResult } from '@nisli/ssg';
import { Button, buttonVariants } from './src/nisli-ui/ui/button.js';
import { Badge } from './src/nisli-ui/ui/badge.js';
import { Label } from './src/nisli-ui/ui/label.js';
import { Separator } from './src/nisli-ui/ui/separator.js';
import { Skeleton } from './src/nisli-ui/ui/skeleton.js';
import { Alert, AlertTitle, AlertDescription } from './src/nisli-ui/ui/alert.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './src/nisli-ui/ui/card.js';
import { Input } from './src/nisli-ui/ui/input.js';
import { Textarea } from './src/nisli-ui/ui/textarea.js';
import { Checkbox } from './src/nisli-ui/ui/checkbox.js';
import { Switch } from './src/nisli-ui/ui/switch.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './src/nisli-ui/ui/tabs.js';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './src/nisli-ui/ui/accordion.js';
import { RadioGroup, RadioGroupItem } from './src/nisli-ui/ui/radio-group.js';
import { Select } from './src/nisli-ui/ui/select.js';
import {
  FormField,
  FieldDescription,
  FieldError,
} from './src/nisli-ui/ui/form-field.js';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './src/nisli-ui/ui/dialog.js';

function section(title: string, body: TemplateResult): TemplateResult {
  return html`<section class="space-y-3">
    <h2 class="text-xl font-semibold tracking-tight">${title}</h2>
    ${body}
  </section>`;
}

export function renderKitchenSink(): TemplateResult {
  return html`<main class="mx-auto max-w-3xl space-y-10 p-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">@nisli/ui — kitchen sink</h1>
      <p class="text-muted-foreground">
        Every registry component, installed by the CLI and rendered statically
        with @nisli/ssg.
      </p>
    </header>

    ${section(
      'Buttons',
      html`<div class="flex flex-wrap items-center gap-3">
        ${Button({ children: 'Default' })}
        ${Button({ variant: 'secondary', children: 'Secondary' })}
        ${Button({ variant: 'destructive', children: 'Destructive' })}
        ${Button({ variant: 'outline', children: 'Outline' })}
        ${Button({ variant: 'ghost', children: 'Ghost' })}
        ${Button({ variant: 'link', children: 'Link' })}
        ${Button({ size: 'sm', children: 'Small' })}
        ${Button({ size: 'lg', children: 'Large' })}
        ${Button({ disabled: true, children: 'Disabled' })}
      </div>`,
    )}

    ${section(
      'Badges',
      html`<div class="flex flex-wrap items-center gap-3">
        ${Badge({ children: 'Default' })}
        ${Badge({ variant: 'secondary', children: 'Secondary' })}
        ${Badge({ variant: 'destructive', children: 'Destructive' })}
        ${Badge({ variant: 'outline', children: 'Outline' })}
      </div>`,
    )}

    ${section(
      'Alert',
      Alert({
        children: html`${AlertTitle({ children: 'Heads up!' })}
        ${AlertDescription({
          children: 'Every line of this component lives in your own repository.',
        })}`,
      }),
    )}

    ${section(
      'Card with a form',
      Card({
        className: 'max-w-md',
        children: html`${CardHeader({
          children: html`${CardTitle({ children: 'Create account' })}
          ${CardDescription({ children: 'Native form controls in light DOM.' })}`,
        })}
        ${CardContent({
          children: html`<form class="space-y-4">
            <div class="space-y-1.5">
              ${Label({ htmlFor: 'demo-email', children: 'Email' })}
              ${Input({ id: 'demo-email', name: 'email', type: 'email', placeholder: 'you@example.com' })}
            </div>
            <div class="space-y-1.5">
              ${Label({ htmlFor: 'demo-bio', children: 'Bio' })}
              ${Textarea({ id: 'demo-bio', name: 'bio', placeholder: 'Tell us about yourself' })}
            </div>
            <div class="flex items-center gap-2">
              ${Checkbox({ id: 'demo-terms', name: 'terms' })}
              ${Label({ htmlFor: 'demo-terms', children: 'Accept terms' })}
            </div>
            <div class="flex items-center gap-2">
              ${Switch({ id: 'demo-news', name: 'newsletter', checked: true })}
              ${Label({ htmlFor: 'demo-news', children: 'Newsletter' })}
            </div>
          </form>`,
        })}
        ${CardFooter({
          className: 'flex gap-2',
          children: html`${Button({ type: 'submit', children: 'Sign up' })}
          ${Button({ variant: 'outline', children: 'Cancel' })}`,
        })}`,
      }),
    )}

    ${Separator({})}

    ${section(
      'Tabs',
      Tabs({
        defaultValue: 'account',
        children: html`${TabsList({
          children: html`${TabsTrigger({ value: 'account', children: 'Account' })}
          ${TabsTrigger({ value: 'password', children: 'Password' })}`,
        })}
        ${TabsContent({ value: 'account', children: 'Account settings live here.' })}
        ${TabsContent({ value: 'password', children: 'Change your password here.' })}`,
      }),
    )}

    ${section(
      'Accordion',
      Accordion({
        type: 'single',
        collapsible: true,
        children: html`${AccordionItem({
          value: 'a11y',
          children: html`${AccordionTrigger({ children: 'Is it accessible?' })}
          ${AccordionContent({
            children: 'Yes. It follows the WAI-ARIA accordion pattern.',
          })}`,
        })}
        ${AccordionItem({
          value: 'own',
          children: html`${AccordionTrigger({ children: 'Do I own the code?' })}
          ${AccordionContent({
            children: 'Yes. nisli-ui add copies the source into your project.',
          })}`,
        })}`,
      }),
    )}

    ${section(
      'Radio group',
      RadioGroup({
        name: 'plan',
        defaultValue: 'pro',
        children: html`<div class="flex items-center gap-2">
            ${RadioGroupItem({ value: 'free', id: 'plan-free' })}
            ${Label({ htmlFor: 'plan-free', children: 'Free' })}
          </div>
          <div class="flex items-center gap-2">
            ${RadioGroupItem({ value: 'pro', id: 'plan-pro' })}
            ${Label({ htmlFor: 'plan-pro', children: 'Pro' })}
          </div>`,
      }),
    )}

    ${section(
      'Select',
      Select({
        name: 'fruit',
        defaultValue: 'apple',
        className: 'w-56',
        children: html`<option value="apple">Apple</option>
          <option value="banana">Banana</option>
          <option value="pear">Pear</option>`,
      }),
    )}

    ${section(
      'Form field',
      FormField({
        invalid: true,
        children: html`${Label({ children: 'Email' })}
        ${Input({ type: 'email', name: 'field-email', value: 'not-an-email' })}
        ${FieldDescription({ children: "We'll never share your email." })}
        ${FieldError({ children: 'Enter a valid email address.' })}`,
      }),
    )}

    ${section(
      'Dialog',
      Dialog({
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
      }),
    )}

    ${section(
      'Skeleton',
      html`<div class="flex items-center gap-4">
        ${Skeleton({ className: 'size-12 rounded-full' })}
        <div class="space-y-2">
          ${Skeleton({ className: 'h-4 w-64' })}
          ${Skeleton({ className: 'h-4 w-40' })}
        </div>
      </div>`,
    )}
  </main>`;
}

/** Build the demo site into `outDir` (used by tests and manual builds). */
export function buildDemoSite(outDir: string): Promise<StaticSiteBuildResult> {
  return buildStaticSite({
    outDir,
    routes: [{ path: '/', render: () => renderKitchenSink() }],
  });
}
