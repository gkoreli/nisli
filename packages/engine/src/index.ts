/**
 * @nisli/engine — typed blocks decided by an engine.
 *
 * App code says what things are. The engine decides how they are laid out and
 * what fits — with no visuals of its own. A skin, installed once with
 * `useSkin()`, says what the parts look like. There is no CSS file, no
 * className, no style prop, no data-* attribute in the public surface: none
 * of those are offered by the types below.
 */
export type { Content, Children, Action, Tone } from './blocks/types.js';
export { App, type AppProps, type NavItem } from './blocks/app.js';
export { Page, type PageProps } from './blocks/page.js';
export { Toolbar, type ToolbarProps } from './blocks/toolbar.js';
export { Section, type SectionProps } from './blocks/section.js';
export { Grid, type GridProps } from './blocks/grid.js';
export { Stat, type StatProps } from './blocks/stat.js';
export { Table, type Column, type Sort, type TableProps, type CellValue } from './blocks/table.js';
export { Form, type Field, type FieldKind, type FormProps } from './blocks/form.js';
export { Dialog, type DialogProps } from './blocks/dialog.js';
export { Meter, type MeterProps } from './blocks/meter.js';
export { Bars, type BarsProps, type BarItem } from './blocks/bars.js';
export { Empty, type EmptyProps } from './blocks/empty.js';
export { Text, Link, type TextProps, type LinkProps } from './blocks/text.js';
export { Columns, type ColumnsProps, type Series } from './blocks/columns.js';
export { notify } from './blocks/notice.js';
export { viewOf, type Status, type StatusView } from './blocks/status.js';
export { confirm, type ConfirmOptions } from './blocks/confirm.js';

export { metrics, type Metrics } from './metrics.js';
export { useSkin, setScheme, look, scheme, PARTS, type Skin, type SkinParts, type SkinAxes, type SkinOptions, type Scheme, type Part } from './skin.js';
export { defaultSkin, lightPalette, darkPalette, partsOf } from './skin/default.js';
export type { StyleRecord } from './style.js';

export { fit, type FitInput, type FitItem, type FitPlan, type FitDecision, type FitAction } from './engine/fit.js';
export { columnsFor } from './engine/columns.js';
export { onReport, type LayoutReport, type ReportCode } from './engine/report.js';
