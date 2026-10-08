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
    const native = createMemo(() => props.panelProps?.(item));
    const style = () => {
      const value = native()?.style;
      if (props.active(item)) return value;
      return typeof value === 'string' ? `${value.trim().replace(/;+$/, '')};display:none !important;` : { ...value, display: 'none' };
    };
    return <Dynamic component={props.as ?? 'div'} {...native()} style={style()}
      hidden={!props.active(item)} inert={!props.active(item)}>{props.children(item)}</Dynamic>;
  }}</For>;
}
