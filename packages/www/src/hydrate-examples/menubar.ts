import { html, type TemplateResult } from '@nisli/core';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarShortcut,
  MenubarSeparator,
} from '../nisli-ui/ui/menubar.js';

export default function menubarExample(): TemplateResult {
  return html`${Menubar({
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
    })}`,
  })}`;
}
