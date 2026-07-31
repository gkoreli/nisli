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
import { Avatar, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount } from './nisli-ui/ui/avatar.js';
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
// WWW-15: non-overlay interactive previews — per-file so they hydrate + code-split
// like the overlays (accordion tap-expands, tabs switch, calendar day-select,
// carousel nav, collapsible toggle, toggle/toggle-group press, button-group click).
import accordionExample from './hydrate-examples/accordion.js';
import tabsExample from './hydrate-examples/tabs.js';
import carouselExample from './hydrate-examples/carousel.js';
import calendarExample from './hydrate-examples/calendar.js';
import collapsibleExample from './hydrate-examples/collapsible.js';
import toggleExample from './hydrate-examples/toggle.js';
import toggleGroupExample from './hydrate-examples/toggle-group.js';
import buttonGroupExample from './hydrate-examples/button-group.js';
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
import {
  AttachmentGroup,
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from './nisli-ui/ui/attachment.js';
import { Marker, MarkerIcon, MarkerContent } from './nisli-ui/ui/marker.js';
import { MessageGroup, Message, MessageAvatar, MessageContent, MessageHeader } from './nisli-ui/ui/message.js';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from './nisli-ui/ui/message-scroller.js';
import { AcpContent } from './nisli-ui/ui/acp/acp-content.js';
import { AcpDiff } from './nisli-ui/ui/acp/acp-diff.js';
import { AcpPermission } from './nisli-ui/ui/acp/acp-permission.js';
import { AcpPlan } from './nisli-ui/ui/acp/acp-plan.js';
import { AcpThought } from './nisli-ui/ui/acp/acp-thought.js';
import { AcpToolCall } from './nisli-ui/ui/acp/acp-tool-call.js';
// WWW-14 curation surfaces
import navigationMenuExample from './hydrate-examples/navigation-menu.js';
import toastExample from './hydrate-examples/toast.js';
import scrollAreaExample from './hydrate-examples/scroll-area.js';
import acpTranscriptExample from './hydrate-examples/acp-transcript.js';
import acpChatExample from './hydrate-examples/acp-chat.js';
import { Toggle } from './nisli-ui/ui/toggle.js';
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
  // WWW-14: exercise AvatarBadge (status ring) + AvatarGroup (overlap) +
  // AvatarGroupCount (overflow chip) so eng1's batch-2 surfaces are present in
  // the preview DOM for post-deploy verification (authoring only — eng1 owns
  // the ring-paint / overlap-geometry / count-stack visual verdict).
  avatar: () =>
    html`<div class="flex items-center gap-8">
      ${Avatar({
        children: html`${AvatarFallback({ children: 'NS' })}${AvatarBadge({})}`,
      })}
      ${AvatarGroup({
        children: html`${Avatar({ children: AvatarFallback({ children: 'AB' }) })}
        ${Avatar({ children: AvatarFallback({ children: 'CD' }) })}
        ${Avatar({ children: AvatarFallback({ children: 'EF' }) })}
        ${AvatarGroupCount({ children: '+3' })}`,
      })}
    </div>`,
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
  tabs: tabsExample,
  accordion: accordionExample,
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
  'toggle-group': toggleGroupExample,
  toggle: toggleExample,
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
    // WWW-14: the SidebarProvider is an APP-SHELL (min-h-svh) — correct for a
    // real consumer, but in a boxed preview it inflated the frame to ~svh and the
    // sticky site header clipped the top. Bound it with an OUTER max-h-64
    // overflow-hidden clip (preview-only; the registry component and its inner
    // demo layout are unchanged — the app-shell min-h-svh is right for consumers).
    html`<div class="max-h-64 w-full overflow-hidden">
      ${SidebarProvider({
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
      })}
    </div>`,
  calendar: calendarExample,
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
  carousel: carouselExample,
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
  'button-group': buttonGroupExample,
  collapsible: collapsibleExample,
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
  // WWW-15: attachment auto-defaulted to a childless empty <ui-attachment> — a
  // compositional component needs curated content so the live frame paints.
  attachment: () =>
    html`<div class="w-full max-w-sm">
      ${AttachmentGroup({
        children: html`${Attachment({
          children: html`${AttachmentMedia({
            variant: 'icon',
            children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></svg>`,
          })}
          ${AttachmentContent({
            children: html`${AttachmentTitle({ children: 'quarterly-report.pdf' })}
            ${AttachmentDescription({ children: '2.4 MB · PDF' })}`,
          })}`,
        })}
        ${Attachment({
          children: html`${AttachmentMedia({
            variant: 'icon',
            children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>`,
          })}
          ${AttachmentContent({
            children: html`${AttachmentTitle({ children: 'cover.png' })}
            ${AttachmentDescription({ children: '512 KB · Image' })}`,
          })}`,
        })}`,
      })}
    </div>`,
  // WWW-14 — NO-UPSTREAM family (marker/message/message-scroller): DESIGNED
  // examples using the fuller API. Design is a human-judgment call and stays
  // PENDING sign-off (no upstream reference to match); these are improvements
  // over the bare WS1 placeholders, not a closed visual verdict.
  marker: () =>
    html`<div class="flex flex-col gap-3 text-sm">
      ${Marker({
        children: html`${MarkerIcon({
          children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M20 6 9 17l-5-5" /></svg>`,
        })}${MarkerContent({ children: 'Cloned the repository' })}`,
      })}
      ${Marker({
        children: html`${MarkerIcon({
          children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M20 6 9 17l-5-5" /></svg>`,
        })}${MarkerContent({ children: 'Installed dependencies' })}`,
      })}
      ${Marker({
        children: html`${MarkerIcon({
          children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><circle cx="12" cy="12" r="3" /></svg>`,
        })}${MarkerContent({ children: html`Building the site<span class="text-muted-foreground"> — in progress</span>` })}`,
      })}
    </div>`,
  message: () =>
    html`<div class="w-full max-w-md">
      ${MessageGroup({
        children: html`${Message({
          children: html`${MessageAvatar({
            children: html`<span class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">NS</span>`,
          })}
          ${MessageContent({
            children: html`${MessageHeader({ children: html`<span class="font-medium">nisli</span> <span class="text-xs text-muted-foreground">2:14 PM</span>` })}
            Can you copy in the dialog component?`,
          })}`,
        })}
        ${Message({
          align: 'end',
          children: html`${MessageAvatar({
            children: html`<span class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">You</span>`,
          })}
          ${MessageContent({
            children: html`${MessageHeader({ children: html`<span class="font-medium">You</span> <span class="text-xs text-muted-foreground">2:15 PM</span>` })}
            <span data-message-sentence>Done — <code class="inline rounded bg-muted px-1 py-0.5 text-xs">npx @nisli/ui add dialog</code><span data-message-period>.</span></span>`,
          })}`,
        })}`,
      })}
    </div>`,
  'message-scroller': () => {
    const convo = [
      { align: 'start' as const, text: 'Welcome to the nisli chat demo.' },
      { align: 'end' as const, text: 'How do I install a component?' },
      { align: 'start' as const, text: 'Run npx @nisli/ui add <name> — the source lands in your repo.' },
      { align: 'end' as const, text: 'And I own the code after that?' },
      { align: 'start' as const, text: 'Exactly. Edit it freely; it never auto-updates.' },
      { align: 'end' as const, text: 'Perfect, thanks!' },
    ];
    return html`<div class="h-56 w-full max-w-sm">
      ${MessageScrollerProvider({
        children: MessageScroller({
          className: 'h-full rounded-lg border',
          children: MessageScrollerViewport({
            children: MessageScrollerContent({
              className: 'flex flex-col gap-3 p-4',
              children: html`${convo.map((m) =>
                MessageScrollerItem({
                  children: Message({
                    align: m.align,
                    children: MessageContent({
                      className:
                        'rounded-lg px-3 py-2 ' +
                        (m.align === 'end' ? 'bg-primary text-primary-foreground' : 'bg-muted'),
                      children: m.text,
                    }),
                  }),
                }),
              )}`,
            }),
          }),
        }),
      })}
    </div>`;
  },
  // WWW-14: the dropdown surface (Trigger + Content panel) lives in the
  // hydrate-set so it opens on hover and the panel is assessable — links-only
  // couldn't show it. See src/hydrate-examples/navigation-menu.ts.
  'navigation-menu': navigationMenuExample,
  // WWW-14: scroll-area injects its thin-scrollbar stylesheet at RUNTIME, and
  // toast is side-effectful (button → toast.*() → Toaster) — both were inert as
  // static examples, so they join the hydrate-set. See src/hydrate-examples/.
  'scroll-area': scrollAreaExample,
  toast: toastExample,
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
  // ── ACP (Agent Client Protocol) ────────────────────────────────────
  // These render real session data: each example is the exact payload an ACP
  // agent puts on the wire, folded through the same reducer a live client uses.
  'acp-content': () =>
    html`<div class="flex w-full max-w-xl flex-col gap-3">
      ${AcpContent({
        content: [
          { type: 'text', text: 'Reading the config, then patching the resolver.' },
          {
            type: 'resource_link',
            uri: 'file:///src/resolver.ts',
            name: 'resolver.ts',
            title: 'src/resolver.ts',
          },
          { type: 'resource', resource: { uri: 'file:///tsconfig.json', text: '{\n  "strict": true\n}' } },
        ],
      })}
    </div>`,
  'acp-diff': () =>
    html`<div class="w-full max-w-xl">
      ${AcpDiff({
        path: 'src/resolver.ts',
        oldText: 'export function resolve(id) {\n  return cache[id];\n}',
        newText: 'export function resolve(id) {\n  const hit = cache[id];\n  if (hit) return hit;\n  return load(id);\n}',
      })}
    </div>`,
  'acp-plan': () =>
    html`<div class="w-full max-w-xl">
      ${AcpPlan({
        entries: [
          { content: 'Read the failing test', status: 'completed', priority: 'high' },
          { content: 'Patch the resolver cache', status: 'in_progress', priority: 'high' },
          { content: 'Re-run the suite', status: 'pending', priority: 'medium' },
        ],
      })}
    </div>`,
  'acp-thought': () =>
    html`<div class="w-full max-w-xl">
      ${AcpThought({
        content: [
          {
            type: 'text',
            text: 'The cache is populated but never read on the hot path, so every call re-loads.',
          },
        ],
      })}
    </div>`,
  'acp-tool-call': () =>
    html`<div class="flex w-full max-w-xl flex-col gap-3">
      ${AcpToolCall({
        call: {
          toolCallId: 'c1',
          title: 'Read src/resolver.ts',
          kind: 'read',
          status: 'completed',
          locations: [{ path: 'src/resolver.ts', line: 12 }],
        },
      })}
      ${AcpToolCall({
        call: {
          toolCallId: 'c2',
          title: 'Run the test suite',
          kind: 'execute',
          status: 'failed',
          rawInput: { command: 'pnpm test' },
          content: [{ type: 'content', content: { type: 'text', text: '1 failing: resolver caches' } }],
        },
      })}
    </div>`,
  'acp-permission': () =>
    html`<div class="w-full max-w-xl">
      ${AcpPermission({
        prompt: 'The agent wants to write this change to disk.',
        toolCall: {
          toolCallId: 'c3',
          title: 'Edit src/resolver.ts',
          kind: 'edit',
          status: 'pending',
          content: [
            {
              type: 'diff',
              path: 'src/resolver.ts',
              oldText: '  return cache[id];',
              newText: '  const hit = cache[id];\n  if (hit) return hit;',
            },
          ],
        },
        options: [
          { optionId: 'o1', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'o2', name: 'Allow all edits', kind: 'allow_always' },
          { optionId: 'o3', name: 'Reject', kind: 'reject_once' },
        ],
      })}
    </div>`,
  'acp-transcript': acpTranscriptExample,
  'acp-chat': acpChatExample,
};

export function getExample(name: string): (() => TemplateResult) | undefined {
  return examples[name];
}
