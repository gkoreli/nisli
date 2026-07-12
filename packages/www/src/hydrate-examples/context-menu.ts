import { html, type TemplateResult } from '@nisli/core';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuItem,
  ContextMenuShortcut,
} from '../nisli-ui/ui/context-menu.js';

export default function contextMenuExample(): TemplateResult {
  return html`${ContextMenu({
    children: html`${ContextMenuTrigger({
      className:
        'flex h-32 w-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground',
      children: 'Right-click here',
    })}
    ${ContextMenuContent({
      className: 'w-52',
      children: html`${ContextMenuLabel({ children: 'Actions' })}
      ${ContextMenuSeparator({})}
      ${ContextMenuItem({ value: 'back', children: html`Back ${ContextMenuShortcut({ children: '⌘[' })}` })}
      ${ContextMenuItem({ value: 'reload', children: 'Reload' })}
      ${ContextMenuSeparator({})}
      ${ContextMenuItem({ value: 'delete', variant: 'destructive', children: 'Delete' })}`,
    })}`,
  })}`;
}
