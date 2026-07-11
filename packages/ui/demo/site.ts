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
import { AspectRatio } from './src/nisli-ui/ui/aspect-ratio.js';
import { Kbd, KbdGroup } from './src/nisli-ui/ui/kbd.js';
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
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './src/nisli-ui/ui/collapsible.js';
import { Tooltip, TooltipTrigger, TooltipContent } from './src/nisli-ui/ui/tooltip.js';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from './src/nisli-ui/ui/hover-card.js';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from './src/nisli-ui/ui/navigation-menu.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './src/nisli-ui/ui/dropdown-menu.js';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuItem,
  ContextMenuShortcut,
} from './src/nisli-ui/ui/context-menu.js';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from './src/nisli-ui/ui/menubar.js';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from './src/nisli-ui/ui/popover.js';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './src/nisli-ui/ui/alert-dialog.js';
import { RadioGroup, RadioGroupItem } from './src/nisli-ui/ui/radio-group.js';
import { Select } from './src/nisli-ui/ui/select.js';
import {
  FormField,
  FieldDescription,
  FieldError,
} from './src/nisli-ui/ui/form-field.js';
import { Toaster, toast } from './src/nisli-ui/ui/toast.js';
import { Toggle } from './src/nisli-ui/ui/toggle.js';
import { ScrollArea } from './src/nisli-ui/ui/scroll-area.js';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './src/nisli-ui/ui/command.js';
import { ToggleGroup, ToggleGroupItem } from './src/nisli-ui/ui/toggle-group.js';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './src/nisli-ui/ui/dialog.js';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './src/nisli-ui/ui/table.js';
import { Avatar, AvatarImage, AvatarFallback } from './src/nisli-ui/ui/avatar.js';
import { Progress } from './src/nisli-ui/ui/progress.js';
import { Slider } from './src/nisli-ui/ui/slider.js';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './src/nisli-ui/ui/breadcrumb.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './src/nisli-ui/ui/pagination.js';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from './src/nisli-ui/ui/sheet.js';

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
      'Aspect Ratio',
      AspectRatio({
        ratio: 16 / 9,
        className: 'overflow-hidden rounded-lg bg-muted',
        children: html`<div class="flex h-full items-center justify-center text-muted-foreground">
          16 / 9
        </div>`,
      }),
    )}

    ${section(
      'Keyboard',
      html`<div class="flex items-center gap-3">
        ${Kbd({ children: 'Esc' })}
        ${KbdGroup({
          children: html`${Kbd({ children: '⌘' })}${Kbd({ children: 'K' })}`,
        })}
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
      'Collapsible',
      Collapsible({
        defaultOpen: true,
        className: 'w-full max-w-md space-y-2',
        children: html`<div class="flex items-center justify-between gap-4">
            <span class="text-sm font-medium">Starred repositories</span>
            ${CollapsibleTrigger({
              className: buttonVariants({ variant: 'ghost', size: 'sm' }),
              children: 'Toggle',
            })}
          </div>
          ${CollapsibleContent({
            className: 'space-y-2',
            children: html`<div class="rounded-md border px-4 py-2 text-sm">@nisli/core</div>
            <div class="rounded-md border px-4 py-2 text-sm">@nisli/ui</div>`,
          })}`,
      }),
    )}

    ${section(
      'Tooltip',
      Tooltip({
        children: html`${TooltipTrigger({
          className: buttonVariants({ variant: 'outline' }),
          children: 'Hover me',
        })}
        ${TooltipContent({ children: 'Rendered statically; opens on hover.' })}`,
      }),
    )}

    ${section(
      'Navigation menu',
      NavigationMenu({
        children: NavigationMenuList({
          children: html`${NavigationMenuItem({
            children: html`${NavigationMenuTrigger({ value: 'getting-started', children: 'Getting started' })}
            ${NavigationMenuContent({
              value: 'getting-started',
              children: html`${NavigationMenuLink({ href: '#install', children: 'Install' })}
              ${NavigationMenuLink({ href: '#framework', children: 'Framework' })}`,
            })}`,
          })}
          ${NavigationMenuItem({
            children: NavigationMenuLink({ href: '#gallery', children: 'Components' }),
          })}`,
        }),
      }),
    )}

    ${section(
      'Hover card',
      HoverCard({
        children: html`${HoverCardTrigger({
          className: 'cursor-default font-medium underline underline-offset-4',
          children: '@nisli',
        })}
        ${HoverCardContent({
          children: 'A reactive web-component framework — signals, html templates, DI.',
        })}`,
      }),
    )}

    ${section(
      'Popover',
      Popover({
        children: html`${PopoverTrigger({
          className: buttonVariants({ variant: 'outline' }),
          children: 'Open popover',
        })}
        ${PopoverContent({
          children: html`${PopoverHeader({
            children: html`${PopoverTitle({ children: 'Dimensions' })}
            ${PopoverDescription({ children: 'Set the dimensions for the layer.' })}`,
          })}`,
        })}`,
      }),
    )}

    ${section(
      'Alert dialog',
      AlertDialog({
        children: html`${AlertDialogTrigger({
          className: buttonVariants({ variant: 'destructive' }),
          children: 'Delete account',
        })}
        ${AlertDialogContent({
          children: html`${AlertDialogHeader({
            children: html`${AlertDialogTitle({ children: 'Are you absolutely sure?' })}
            ${AlertDialogDescription({
              children: 'This permanently deletes your account and cannot be undone.',
            })}`,
          })}
          ${AlertDialogFooter({
            children: html`${AlertDialogCancel({ children: 'Cancel' })}
            ${AlertDialogAction({ variant: 'destructive', children: 'Delete' })}`,
          })}`,
        })}`,
      }),
    )}

    ${section(
      'Dropdown menu',
      DropdownMenu({
        children: html`${DropdownMenuTrigger({
          className: buttonVariants({ variant: 'outline' }),
          children: 'Open menu',
        })}
        ${DropdownMenuContent({
          className: 'w-56',
          children: html`${DropdownMenuLabel({ children: 'My Account' })}
          ${DropdownMenuSeparator({})}
          ${DropdownMenuItem({
            value: 'profile',
            children: html`Profile ${DropdownMenuShortcut({ children: '⇧⌘P' })}`,
          })}
          ${DropdownMenuItem({ value: 'settings', children: 'Settings' })}
          ${DropdownMenuSub({
            children: html`${DropdownMenuSubTrigger({ children: 'Invite users' })}
            ${DropdownMenuSubContent({
              children: html`${DropdownMenuItem({ value: 'email', children: 'Email' })}
              ${DropdownMenuItem({ value: 'message', children: 'Message' })}`,
            })}`,
          })}
          ${DropdownMenuSeparator({})}
          ${DropdownMenuItem({
            value: 'logout',
            variant: 'destructive',
            children: 'Log out',
          })}`,
        })}`,
      }),
    )}

    ${section(
      'Context menu',
      ContextMenu({
        children: html`${ContextMenuTrigger({
          className:
            'flex h-32 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground',
          children: 'Right-click here',
        })}
        ${ContextMenuContent({
          className: 'w-52',
          children: html`${ContextMenuLabel({ children: 'Actions' })}
          ${ContextMenuSeparator({})}
          ${ContextMenuItem({
            value: 'back',
            children: html`Back ${ContextMenuShortcut({ children: '⌘[' })}`,
          })}
          ${ContextMenuItem({ value: 'reload', children: 'Reload' })}
          ${ContextMenuSeparator({})}
          ${ContextMenuItem({ value: 'delete', variant: 'destructive', children: 'Delete' })}`,
        })}`,
      }),
    )}

    ${section(
      'Menubar',
      Menubar({
        children: html`${MenubarMenu({
          children: html`${MenubarTrigger({ children: 'File' })}
          ${MenubarContent({
            children: html`${MenubarItem({
              value: 'new-tab',
              children: html`New Tab ${MenubarShortcut({ children: '⌘T' })}`,
            })}
            ${MenubarItem({ value: 'new-window', children: 'New Window' })}
            ${MenubarSeparator({})}
            ${MenubarItem({ value: 'print', children: 'Print' })}`,
          })}`,
        })}
        ${MenubarMenu({
          children: html`${MenubarTrigger({ children: 'Edit' })}
          ${MenubarContent({
            children: html`${MenubarItem({ value: 'undo', children: 'Undo' })}
            ${MenubarItem({ value: 'redo', children: 'Redo' })}`,
          })}`,
        })}
        ${MenubarMenu({
          children: html`${MenubarTrigger({ children: 'View' })}
          ${MenubarContent({
            children: html`${MenubarItem({ value: 'reload', children: 'Reload' })}
            ${MenubarItem({ value: 'fullscreen', children: 'Toggle Fullscreen' })}`,
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
      'Sheet',
      Sheet({
        children: html`${SheetTrigger({
          className: buttonVariants({ variant: 'outline' }),
          children: 'Open sheet',
        })}
        ${SheetContent({
          side: 'right',
          children: html`${SheetHeader({
            children: html`${SheetTitle({ children: 'Edit profile' })}
            ${SheetDescription({ children: "Make changes and save when you're done." })}`,
          })}
          ${SheetFooter({
            children: SheetClose({
              className: buttonVariants({ variant: 'outline' }),
              children: 'Close',
            }),
          })}`,
        })}`,
      }),
    )}

    ${section(
      'Breadcrumb',
      Breadcrumb({
        children: BreadcrumbList({
          children: html`${BreadcrumbItem({
            children: BreadcrumbLink({ href: '/', children: 'Home' }),
          })}${BreadcrumbSeparator({})}
          ${BreadcrumbItem({
            children: BreadcrumbLink({ href: '/components', children: 'Components' }),
          })}${BreadcrumbSeparator({})}
          ${BreadcrumbItem({ children: BreadcrumbPage({ children: 'Breadcrumb' }) })}`,
        }),
      }),
    )}

    ${section(
      'Pagination',
      Pagination({
        children: PaginationContent({
          children: html`${PaginationItem({ children: PaginationPrevious({ href: '#' }) })}
          ${PaginationItem({ children: PaginationLink({ href: '#', children: '1' }) })}
          ${PaginationItem({
            children: PaginationLink({ href: '#', isActive: true, children: '2' }),
          })}
          ${PaginationItem({ children: PaginationLink({ href: '#', children: '3' }) })}
          ${PaginationItem({ children: PaginationEllipsis({}) })}
          ${PaginationItem({ children: PaginationNext({ href: '#' }) })}`,
        }),
      }),
    )}

    ${section('Progress', Progress({ value: 60, className: 'max-w-sm' }))}

    ${section('Slider', Slider({ defaultValue: 40, className: 'max-w-sm' }))}

    ${section(
      'Avatar',
      html`<div class="flex items-center gap-4">
        ${Avatar({
          children: html`${AvatarImage({ src: 'https://github.com/shadcn.png', alt: '@shadcn' })}
          ${AvatarFallback({ children: 'CN' })}`,
        })}
        ${Avatar({
          size: 'lg',
          children: AvatarFallback({ children: 'AB' }),
        })}
      </div>`,
    )}

    ${section(
      'Table',
      Table({
        children: html`${TableCaption({ children: 'Recent invoices.' })}
        ${TableHeader({
          children: TableRow({
            children: html`${TableHead({ children: 'Invoice' })}
            ${TableHead({ children: 'Status' })}${TableHead({ children: 'Amount' })}`,
          }),
        })}
        ${TableBody({
          children: html`${TableRow({
            children: html`${TableCell({ children: 'INV-001' })}
            ${TableCell({ children: 'Paid' })}${TableCell({ children: '$250.00' })}`,
          })}
          ${TableRow({
            children: html`${TableCell({ children: 'INV-002' })}
            ${TableCell({ children: 'Pending' })}${TableCell({ children: '$150.00' })}`,
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
    ${section(
      'Toggle',
      html`<div class="flex items-center gap-4">
        ${Toggle({ variant: 'outline', children: 'Bold' })}
        ${ToggleGroup({
          type: 'single',
          variant: 'outline',
          defaultValue: 'center',
          children: html`${ToggleGroupItem({ value: 'left', children: 'Left' })}
          ${ToggleGroupItem({ value: 'center', children: 'Center' })}
          ${ToggleGroupItem({ value: 'right', children: 'Right' })}`,
        })}
      </div>`,
    )}

    ${section(
      'Scroll area',
      ScrollArea({
        className: 'h-32 w-64 rounded-md border p-3',
        children: html`${Array.from({ length: 12 }, (_, i) => html`<p class="py-1 text-sm">Scrollable row ${i + 1}</p>`)}`,
      }),
    )}

    ${section(
      'Command',
      html`<div class="max-w-md rounded-lg border shadow-md">
        ${Command({
          children: html`${CommandInput({ placeholder: 'Type a command or search…' })}
          ${CommandList({
            children: html`${CommandEmpty({ children: 'No results found.' })}
            ${CommandGroup({
              heading: 'Suggestions',
              children: html`${CommandItem({ value: 'calendar', children: 'Calendar' })}
              ${CommandItem({ value: 'emoji', children: 'Search Emoji' })}
              ${CommandItem({ value: 'calculator', children: 'Calculator' })}`,
            })}`,
          })}`,
        })}
      </div>`,
    )}

    ${section(
      'Toast',
      html`<div class="flex gap-3">
        ${Button({
          variant: 'outline',
          children: 'Show toast',
          className: 'toast-demo-trigger',
        })}
        ${Toaster({})}
      </div>`,
    )}
  </main>`;
}

/** Demo helper so the static page ships a wired example (see demo docs). */
export function showDemoToast(): number {
  return toast.success('Saved', { description: 'Your changes are live.' });
}

/** Build the demo site into `outDir` (used by tests and manual builds). */
export function buildDemoSite(outDir: string): Promise<StaticSiteBuildResult> {
  return buildStaticSite({
    outDir,
    routes: [{ path: '/', render: () => renderKitchenSink() }],
  });
}
