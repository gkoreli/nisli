/**
 * ui/ — the component library, and the exclusivity claim.
 *
 * Every component below declares only what a thing IS (`data-appearance`,
 * `data-role`, `data-text`), how it composes (`data-layout`, `data-grow`,
 * `data-align`), and what matters least (`data-priority`, `data-collapse`).
 * Values are resolved by src/theme/ from the inherited context.
 *
 * The claim this barrel makes is negative, and it is checkable in one command
 * (proof/no-values-guard.mjs): there is no `size` prop and no class-name prop
 * on any export, and no file here contains a pixel value, a colour, a rem, an em
 * or a media query — except primitives/escaped.ts, which exists to be raw and
 * reports itself as N601. The caller cannot make an appearance decision because
 * no channel exists through which to make one.
 */

export { Avatar, type AvatarProps } from './primitives/avatar.js';
export { Button, type ButtonProps } from './primitives/button.js';
export { Escaped, type EscapedProps } from './primitives/escaped.js';
export { Field, type FieldProps } from './primitives/field.js';
export { NavItem, type NavItemProps } from './primitives/nav-item.js';
export { type Align, type Clip, Region, type RegionProps } from './primitives/region.js';
export { Surface, type SurfaceProps } from './primitives/surface.js';
export { Text, type TextProps, type TextStrategy } from './primitives/text.js';

export {
  DataTable,
  type DataTableProps,
  type TableColumn,
  type TableRow,
} from './patterns/data-table.js';
export { Hero, type HeroProps } from './patterns/hero.js';
export { MessageRow, type MessageRowProps } from './patterns/message-row.js';
export {
  ActionGroup,
  type ActionGroupProps,
  type ActionGroupSpec,
  type ActionScope,
  ActionScopeContext,
  actionScope,
  type MenuAction,
  OverflowMenu,
  type OverflowMenuProps,
  type RegisteredGroup,
} from './patterns/overflow-menu.js';
export { Toolbar, type ToolbarProps } from './patterns/toolbar.js';
