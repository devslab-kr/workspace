import { For, createMemo, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

export interface RetainedPanelsProps<T> {
  /** The application owns this dynamic, already-authorized list. Item identity owns page identity. */
  items: readonly T[];
  active: (item: T) => boolean;
  as?: keyof JSX.IntrinsicElements;
  panelProps?: (item: T) => Omit<JSX.HTMLAttributes<HTMLElement>, 'children' | 'hidden' | 'inert'>;
  children: (item: T) => JSX.Element;
}

/**
 * Retains native Solid page owners while their externally-owned item remains in the list.
 * Replacing/removing an item disposes its owner. Activity never remounts it.
 * Routing, guards, registration, payloads and portal activity remain application-owned.
 */
export function RetainedPanels<T>(props: RetainedPanelsProps<T>): JSX.Element {
  return <For each={props.items}>{item => {
    const native = createMemo(() => {
      const { style: value, ...attributes } = props.panelProps?.(item) ?? {};
      // Omit absent active styles: Solid SSR otherwise serializes style="", which
      // strict CSP consumers correctly reject as an inline style attribute.
      if (props.active(item) && value === undefined) return attributes;
      const style = props.active(item) ? value : typeof value === 'string'
        ? `${value.trim().replace(/;+$/, '')};display:none !important;` : { ...value, display: 'none' };
      return { ...attributes, style };
    });
    return <Dynamic component={props.as ?? 'div'} {...native()}
      hidden={!props.active(item)} inert={!props.active(item)}>{props.children(item)}</Dynamic>;
  }}</For>;
}
