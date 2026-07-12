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
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './nisli-ui/ui/command.js';
// Floating-overlay examples: per-file so the WWW-10 client runtime code-splits them.
import dropdownMenuExample from './hydrate-examples/dropdown-menu.js';
import tooltipExample from './hydrate-examples/tooltip.js';
import popoverExample from './hydrate-examples/popover.js';
import comboboxExample from './hydrate-examples/combobox.js';
import drawerExample from './hydrate-examples/drawer.js';
import contextMenuExample from './hydrate-examples/context-menu.js';
import menubarExample from './hydrate-examples/menubar.js';
import hoverCardExample from './hydrate-examples/hover-card.js';
import dialogExample from './hydrate-examples/dialog.js';
import alertDialogExample from './hydrate-examples/alert-dialog.js';
import sheetExample from './hydrate-examples/sheet.js';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from './nisli-ui/ui/sidebar.js';
import { Calendar } from './nisli-ui/ui/calendar.js';
import {
  Table,
  TableCaption,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from './nisli-ui/ui/table.js';
import { FormField, FieldDescription, FieldError } from './nisli-ui/ui/form-field.js';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from './nisli-ui/ui/carousel.js';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from './nisli-ui/ui/resizable.js';
// RC3 (WWW-11): curated examples so these compositional components paint real
// content instead of an empty auto-default <ui-*> shell.
import { AspectRatio } from './nisli-ui/ui/aspect-ratio.js';
import { BubbleGroup, Bubble } from './nisli-ui/ui/bubble.js';
import { ButtonGroup, ButtonGroupSeparator } from './nisli-ui/ui/button-group.js';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './nisli-ui/ui/collapsible.js';
import { DirectionProvider } from './nisli-ui/ui/direction.js';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from './nisli-ui/ui/input-otp.js';
import { ItemGroup, Item, ItemMedia, ItemContent, ItemTitle, ItemDescription } from './nisli-ui/ui/item.js';
import { Marker, MarkerContent } from './nisli-ui/ui/marker.js';
import { MessageGroup, Message, MessageContent } from './nisli-ui/ui/message.js';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from './nisli-ui/ui/message-scroller.js';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from './nisli-ui/ui/navigation-menu.js';
import { ScrollArea } from './nisli-ui/ui/scroll-area.js';
import { Toaster } from './nisli-ui/ui/toast.js';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from './nisli-ui/ui/empty.js';
import { InputGroup, InputGroupAddon, InputGroupInput } from './nisli-ui/ui/input-group.js';

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
  // Floating overlays live in src/hydrate-examples/ (per-file, so the client
  // hydration runtime code-splits one chunk each). Same example, closed in SSG
  // + alive when hydrated (WWW-10).
  tooltip: tooltipExample,
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
  // Portaled overlays live in src/hydrate-examples/ (per-file, code-split, and
  // in the hydrate-set so their content opens live — ADR 0025 item-6 means the
  // overlay escapes the SSG snapshot, so hydration is the honest preview).
  dialog: dialogExample,
  'alert-dialog': alertDialogExample,
  sheet: sheetExample,
  'dropdown-menu': dropdownMenuExample,
  popover: popoverExample,
  combobox: comboboxExample,
  drawer: drawerExample,
  'context-menu': contextMenuExample,
  menubar: menubarExample,
  'hover-card': hoverCardExample,
  command: () =>
    html`<div class="w-full max-w-sm">
      ${Command({
        className: 'rounded-lg border shadow-sm',
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
  sidebar: () =>
    html`${SidebarProvider({
      children: html`<div class="flex h-64 w-full overflow-hidden rounded-lg border">
        ${Sidebar({
          collapsible: 'none',
          className: 'w-56 border-r',
          children: html`${SidebarHeader({
            children: html`<div class="px-2 py-1 text-sm font-semibold">Acme Inc</div>`,
          })}
          ${SidebarContent({
            children: SidebarGroup({
              children: html`${SidebarGroupLabel({ children: 'Platform' })}
              ${SidebarGroupContent({
                children: SidebarMenu({
                  children: html`${SidebarMenuItem({
                    children: SidebarMenuButton({ isActive: true, children: 'Dashboard' }),
                  })}
                  ${SidebarMenuItem({ children: SidebarMenuButton({ children: 'Projects' }) })}
                  ${SidebarMenuItem({ children: SidebarMenuButton({ children: 'Settings' }) })}`,
                }),
              })}`,
            }),
          })}
          ${SidebarFooter({
            children: html`<div class="px-2 py-1 text-sm text-muted-foreground">shadcn</div>`,
          })}`,
        })}
        <div class="flex-1 p-4 text-sm text-muted-foreground">Main content</div>
      </div>`,
    })}`,
  calendar: () =>
    html`${Calendar({
      mode: 'range',
      defaultMonth: new Date(2024, 5, 1),
      selected: { from: new Date(2024, 5, 9), to: new Date(2024, 5, 15) },
      className: 'rounded-md border',
    })}`,
  table: () => {
    const invoices = [
      { invoice: 'INV001', status: 'Paid', method: 'Credit Card', amount: '$250.00' },
      { invoice: 'INV002', status: 'Pending', method: 'PayPal', amount: '$150.00' },
      { invoice: 'INV003', status: 'Unpaid', method: 'Bank Transfer', amount: '$350.00' },
      { invoice: 'INV004', status: 'Paid', method: 'Credit Card', amount: '$450.00' },
      { invoice: 'INV005', status: 'Paid', method: 'PayPal', amount: '$550.00' },
      { invoice: 'INV006', status: 'Pending', method: 'Bank Transfer', amount: '$200.00' },
      { invoice: 'INV007', status: 'Unpaid', method: 'Credit Card', amount: '$300.00' },
    ];
    return html`<div class="w-full max-w-lg">
      ${Table({
        children: html`${TableCaption({ children: 'A list of your recent invoices.' })}
        ${TableHeader({
          children: TableRow({
            children: html`${TableHead({ className: 'w-[100px]', children: 'Invoice' })}${TableHead({
              children: 'Status',
            })}${TableHead({ children: 'Method' })}${TableHead({ className: 'text-right', children: 'Amount' })}`,
          }),
        })}
        ${TableBody({
          children: html`${invoices.map((row) =>
            TableRow({
              children: html`${TableCell({ className: 'font-medium', children: row.invoice })}${TableCell({
                children: row.status,
              })}${TableCell({ children: row.method })}${TableCell({ className: 'text-right', children: row.amount })}`,
            }),
          )}`,
        })}
        ${TableFooter({
          children: TableRow({
            children: html`${TableCell({ colSpan: 3, className: 'font-medium', children: 'Total' })}${TableCell({
              className: 'text-right',
              children: '$2,500.00',
            })}`,
          }),
        })}`,
      })}
    </div>`;
  },
  'form-field': () =>
    html`<div class="w-full max-w-sm">
      ${FormField({
        invalid: true,
        children: html`${Label({ children: 'Email' })}
        ${Input({ type: 'email', name: 'field-email', value: 'not-an-email' })}
        ${FieldDescription({ children: "We'll never share your email." })}
        ${FieldError({ children: 'Enter a valid email address.' })}`,
      })}
    </div>`,
  carousel: () =>
    html`<div class="mx-auto max-w-xs px-12">
      ${Carousel({
        children: html`${CarouselContent({
          children: html`${CarouselItem({
            children: html`<div class="flex aspect-square items-center justify-center rounded-lg border p-6 text-4xl font-semibold">1</div>`,
          })}
          ${CarouselItem({
            children: html`<div class="flex aspect-square items-center justify-center rounded-lg border p-6 text-4xl font-semibold">2</div>`,
          })}
          ${CarouselItem({
            children: html`<div class="flex aspect-square items-center justify-center rounded-lg border p-6 text-4xl font-semibold">3</div>`,
          })}`,
        })}
        ${CarouselPrevious({})}${CarouselNext({})}`,
      })}
    </div>`,
  resizable: () =>
    html`<div class="h-48 w-full max-w-md">
      ${ResizablePanelGroup({
        direction: 'horizontal',
        className: 'rounded-lg border',
        children: html`${ResizablePanel({
          defaultSize: 40,
          minSize: 20,
          children: html`<div class="flex h-full items-center justify-center p-6 text-sm">Sidebar</div>`,
        })}
        ${ResizableHandle({ withHandle: true })}
        ${ResizablePanel({
          defaultSize: 60,
          minSize: 20,
          children: html`<div class="flex h-full items-center justify-center p-6 text-sm">Content</div>`,
        })}`,
      })}
    </div>`,
  // ── RC3 curated examples (WWW-11): compositional components that render an
  // empty auto-default shell otherwise. Static, SSG-safe resting state. ──
  'aspect-ratio': () =>
    html`<div class="w-full max-w-sm">
      ${AspectRatio({
        ratio: 16 / 9,
        children: html`<div
          class="flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground"
        >
          16 / 9
        </div>`,
      })}
    </div>`,
  bubble: () =>
    html`${BubbleGroup({
      children: html`${Bubble({ children: 'Hey — did the copy-in CLI work for you?' })}
      ${Bubble({ variant: 'tinted', align: 'end', children: 'Yeah, added button + dialog in one command.' })}
      ${Bubble({ children: 'Nice. You own the source now.' })}`,
    })}`,
  'button-group': () =>
    html`${ButtonGroup({
      children: html`${Button({ variant: 'outline', children: 'Cut' })}
      ${Button({ variant: 'outline', children: 'Copy' })}
      ${ButtonGroupSeparator({})}
      ${Button({ variant: 'outline', children: 'Paste' })}`,
    })}`,
  collapsible: () =>
    html`<div class="w-full max-w-sm">
      ${Collapsible({
        defaultOpen: true,
        children: html`<div class="flex items-center justify-between gap-4">
          <span class="text-sm font-semibold">@nisli starred 3 repositories</span>
          ${CollapsibleTrigger({ className: buttonVariants({ variant: 'ghost', size: 'icon-sm' }), children: '⌄' })}
        </div>
        ${CollapsibleContent({
          children: html`<div class="mt-2 grid gap-2">
            <div class="rounded-md border px-4 py-2 text-sm">@nisli/core</div>
            <div class="rounded-md border px-4 py-2 text-sm">@nisli/ui</div>
          </div>`,
        })}`,
      })}
    </div>`,
  direction: () =>
    html`${DirectionProvider({
      dir: 'rtl',
      children: html`<div class="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4 text-sm">
        <p>مرحبا بك في nisli</p>
        <div class="flex gap-2">${Button({ size: 'sm', children: 'إرسال' })}${Button({ size: 'sm', variant: 'outline', children: 'إلغاء' })}</div>
      </div>`,
    })}`,
  'input-otp': () =>
    html`${InputOTP({
      maxLength: 6,
      children: html`${InputOTPGroup({
        children: html`${InputOTPSlot({ index: 0 })}${InputOTPSlot({ index: 1 })}${InputOTPSlot({ index: 2 })}`,
      })}
      ${InputOTPSeparator({})}
      ${InputOTPGroup({
        children: html`${InputOTPSlot({ index: 3 })}${InputOTPSlot({ index: 4 })}${InputOTPSlot({ index: 5 })}`,
      })}`,
    })}`,
  item: () =>
    html`<div class="w-full max-w-sm">
      ${ItemGroup({
        children: html`${Item({
          variant: 'outline',
          children: html`${ItemMedia({ variant: 'icon', children: '◆' })}
          ${ItemContent({
            children: html`${ItemTitle({ children: 'Basic plan' })}
            ${ItemDescription({ children: 'Everything you need to get started.' })}`,
          })}
          ${Button({ size: 'sm', variant: 'outline', children: 'Upgrade' })}`,
        })}`,
      })}
    </div>`,
  marker: () =>
    html`<div class="flex flex-col gap-2">
      ${Marker({ children: MarkerContent({ children: 'Cloned the repository' }) })}
      ${Marker({ children: MarkerContent({ children: 'Installed dependencies' }) })}
      ${Marker({ variant: 'border', children: MarkerContent({ children: 'Ran the build' }) })}
    </div>`,
  message: () =>
    html`<div class="w-full max-w-sm">
      ${MessageGroup({
        children: html`${Message({
          children: MessageContent({ children: 'Can you copy in the dialog component?' }),
        })}
        ${Message({
          align: 'end',
          children: MessageContent({ children: 'Done — npx @nisli/ui add dialog.' }),
        })}`,
      })}
    </div>`,
  'message-scroller': () =>
    html`<div class="h-56 w-full max-w-sm">
      ${MessageScrollerProvider({
        children: MessageScroller({
          className: 'h-full rounded-lg border',
          children: MessageScrollerViewport({
            children: MessageScrollerContent({
              className: 'p-4',
              children: html`${[1, 2, 3, 4, 5, 6].map((n) =>
                MessageScrollerItem({
                  children: html`<div class="mb-2 rounded-md border px-3 py-2 text-sm">Message ${String(n)}</div>`,
                }),
              )}`,
            }),
          }),
        }),
      })}
    </div>`,
  'navigation-menu': () =>
    html`${NavigationMenu({
      children: NavigationMenuList({
        children: html`${NavigationMenuItem({
          children: NavigationMenuLink({ className: navigationMenuTriggerStyle(), href: '/docs', children: 'Docs' }),
        })}
        ${NavigationMenuItem({
          children: NavigationMenuLink({ className: navigationMenuTriggerStyle(), href: '/ui', children: 'Components' }),
        })}
        ${NavigationMenuItem({
          children: NavigationMenuLink({ className: navigationMenuTriggerStyle(), href: '/themes', children: 'Themes' }),
        })}`,
      }),
    })}`,
  'scroll-area': () =>
    html`${ScrollArea({
      className: 'h-56 w-56 rounded-md border',
      children: html`<div class="p-4">
        <h4 class="mb-3 text-sm font-medium leading-none">Tags</h4>
        ${[...Array(24).keys()].map(
          (i) => html`<div class="border-b py-2 text-sm">v1.2.0-beta.${String(i + 1)}</div>`,
        )}
      </div>`,
    })}`,
  toast: () =>
    html`<div class="flex flex-col items-center gap-3">
      ${Button({ variant: 'outline', children: 'Show toast' })}
      ${Toaster({})}
      <p class="text-xs text-muted-foreground">Toasts render into the ui-toaster region.</p>
    </div>`,
  // Manual-pass gaps (WWW-12): both passed the sweep's paints-content check but
  // read near-blank to a human — curate real content.
  empty: () =>
    html`<div class="w-full max-w-sm">
      ${Empty({
        className: 'rounded-lg border border-dashed',
        children: html`${EmptyHeader({
          children: html`${EmptyMedia({ variant: 'icon', children: '🗂️' })}
          ${EmptyTitle({ children: 'No projects yet' })}
          ${EmptyDescription({ children: 'Create your first project to get started.' })}`,
        })}
        ${EmptyContent({ children: Button({ size: 'sm', children: 'New project' }) })}`,
      })}
    </div>`,
  'input-group': () =>
    html`<div class="grid w-full max-w-sm gap-3">
      ${InputGroup({
        children: html`${InputGroupAddon({ children: '🔍' })}
        ${InputGroupInput({ placeholder: 'Search components…' })}`,
      })}
      ${InputGroup({
        children: html`${InputGroupInput({ placeholder: 'you' })}
        ${InputGroupAddon({ align: 'inline-end', children: '@nisli.dev' })}`,
      })}
    </div>`,
};

export function getExample(name: string): (() => TemplateResult) | undefined {
  return examples[name];
}
