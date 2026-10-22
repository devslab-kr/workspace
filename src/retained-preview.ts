/** Dimensions to use when a retained (hidden) screen no longer has a measurable box. */
export interface RetainedPreviewOptions {
  sourceWidth?: number;
  sourceHeight?: number;
}

const excluded = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET', 'LINK', 'STYLE', 'META', 'BASE', 'AUDIO', 'VIDEO', 'SOURCE', 'TRACK']);
const stripped = new Set([
  'id', 'name', 'for', 'form', 'list', 'headers', 'autofocus', 'accesskey', 'is',
  'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant',
  'aria-details', 'aria-errormessage', 'href', 'xlink:href', 'target', 'action', 'method',
  'formaction', 'formtarget', 'formmethod', 'formnovalidate', 'download', 'autoplay',
]);
const privateSelector = '[data-workspace-preview-private],[data-private],[data-workspace-preview="private"]';
const masked = '••••••••';

/**
 * Snapshot retained DOM without remounting a framework or copying its listeners.
 * Passwords and explicitly private subtrees are masked. Call only while the switcher
 * is open; the returned cleanup removes the snapshot and its resize subscription.
 * A null source/host is a no-op, including during SSR.
 */
export function mountRetainedPreview(
  host: HTMLElement | null,
  source: HTMLElement | null,
  options: RetainedPreviewOptions = {},
): () => void {
  const view = host?.ownerDocument.defaultView;
  if (!host || !source || !view || host === source) return () => {};
  const document = host.ownerDocument;
  const scrolls: Array<{ target: Element; top: number; left: number }> = [];

  function copy(original: Element): Element | null {
    const tag = original.tagName.toUpperCase();
    if (excluded.has(tag) || (tag === 'INPUT' && (original as HTMLInputElement).type === 'hidden')) return null;
    // Never construct/upgrade a custom element: its connected callback may perform work.
    const presentationOnly = tag === 'FORM' || original.localName.includes('-') || original.hasAttribute('is');
    const duplicate = presentationOnly
      ? document.createElement('div')
      : document.createElementNS(original.namespaceURI, original.localName);
    // cloneNode also copies a customized built-in's internal `is` value even when
    // hasAttribute('is') is false. Fresh native elements cannot carry that definition.
    for (const attribute of [...original.attributes]) {
      if (!stripped.has(attribute.name.toLowerCase()) && !/^on/i.test(attribute.name)) duplicate.setAttribute(attribute.name, attribute.value);
    }
    const sensitive = original.matches(privateSelector) ||
      (tag === 'INPUT' && ((original as HTMLInputElement).type === 'password' ||
        /^(current-password|new-password|one-time-code|cc-number|cc-csc)$/.test(original.getAttribute('autocomplete') ?? '')));
    if (sensitive) {
      for (const attribute of [...duplicate.attributes]) {
        if (attribute.name !== 'class' && !attribute.name.startsWith('data-v-')) duplicate.removeAttribute(attribute.name);
      }
      duplicate.textContent = tag === 'INPUT' ? '' : masked;
    } else {
      for (const child of [...original.childNodes]) {
        if (child.nodeType === 1) {
          const element = copy(child as Element);
          if (element) duplicate.append(element);
        } else if (child.nodeType === 3) duplicate.append(document.createTextNode(child.textContent ?? ''));
      }
    }
    if (presentationOnly && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      duplicate.textContent = sensitive ? masked
        : tag === 'SELECT' ? [...(original as HTMLSelectElement).selectedOptions].map(option => option.textContent).join(', ')
        : (original as HTMLInputElement).type === 'file' ? '' : (original as HTMLInputElement).value;
    } else if (tag === 'INPUT') {
      const input = duplicate as HTMLInputElement;
      input.value = input.type === 'file' ? '' : sensitive ? masked : (original as HTMLInputElement).value;
      if (input.type === 'file') input.removeAttribute('value');
      if (sensitive) input.defaultValue = '';
      input.checked = !sensitive && (original as HTMLInputElement).checked;
      input.indeterminate = !sensitive && (original as HTMLInputElement).indeterminate;
      if (['submit', 'reset', 'image'].includes(input.type)) input.type = 'button';
    } else if (tag === 'TEXTAREA') {
      (duplicate as HTMLTextAreaElement).value = sensitive ? masked : (original as HTMLTextAreaElement).value;
    } else if (tag === 'SELECT' && !sensitive) {
      const select = original as HTMLSelectElement;
      const target = duplicate as HTMLSelectElement;
      for (let index = 0; index < select.options.length; index++) target.options[index]!.selected = select.options[index]!.selected;
      if (select.selectedIndex === -1) target.selectedIndex = -1;
    }
    if (tag === 'BUTTON') (duplicate as HTMLButtonElement).type = 'button';
    if (duplicate instanceof view!.HTMLElement) {
      duplicate.tabIndex = -1;
      if (duplicate.hasAttribute('contenteditable')) duplicate.contentEditable = 'false';
      duplicate.style.animation = 'none';
      duplicate.style.transition = 'none';
      duplicate.style.caretColor = 'transparent';
    }
    scrolls.push({ target: duplicate, top: original.scrollTop, left: original.scrollLeft });
    return duplicate;
  }
  const snapshot = copy(source) as HTMLElement | null;
  if (!snapshot) return () => {};
  snapshot.hidden = false;
  snapshot.removeAttribute('inert');
  snapshot.removeAttribute('aria-hidden');
  if (snapshot.style.display === 'none') snapshot.style.removeProperty('display');
  const computed = view.getComputedStyle(source);
  // Switcher cards may be portalled outside the workspace's inherited typography/tokens.
  for (const property of ['font', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'direction']) {
    snapshot.style.setProperty(property, computed.getPropertyValue(property));
  }
  for (let index = 0; index < computed.length; index++) {
    const property = computed.item(index);
    if (property.startsWith('--')) snapshot.style.setProperty(property, computed.getPropertyValue(property));
  }
  Object.assign(snapshot.style, { width: '100%', height: '100%', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', boxSizing: 'border-box', overflow: 'hidden' });

  const viewport = document.createElement('div');
  viewport.setAttribute('inert', '');
  viewport.setAttribute('aria-hidden', 'true');
  viewport.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;';
  const canvas = document.createElement('div');
  canvas.setAttribute('data-workspace-preview-canvas', '');
  canvas.style.cssText = 'position:absolute;left:0;top:0;transform-origin:top left;pointer-events:none;';
  canvas.append(snapshot);
  viewport.append(canvas);
  host.append(viewport);

  function positive(...values: Array<number | undefined>): number {
    return values.find(value => value !== undefined && Number.isFinite(value) && value > 0)!;
  }
  const sourceBounds = source.getBoundingClientRect();
  const sourceWidth = positive(sourceBounds.width, source.clientWidth, options.sourceWidth, 1200);
  const sourceHeight = positive(sourceBounds.height, source.clientHeight, options.sourceHeight, 750);
  canvas.style.width = `${sourceWidth}px`;
  canvas.style.height = `${sourceHeight}px`;
  function fit(): void {
    const bounds = host!.getBoundingClientRect();
    const width = positive(bounds.width, host!.clientWidth, 240);
    const height = positive(bounds.height, host!.clientHeight, 150);
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    canvas.style.transform = `translate(${(width - sourceWidth * scale) / 2}px, ${(height - sourceHeight * scale) / 2}px) scale(${scale})`;
    for (const scroll of scrolls) {
      scroll.target.scrollTop = scroll.top;
      scroll.target.scrollLeft = scroll.left;
    }
  }
  fit();
  const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(fit) : undefined;
  if (observer) observer.observe(host);
  else view.addEventListener('resize', fit);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    view.removeEventListener('resize', fit);
    viewport.remove();
  };
}
