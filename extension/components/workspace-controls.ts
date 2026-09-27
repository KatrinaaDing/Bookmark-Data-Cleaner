import { button, checkbox, el } from './dom.js';
import { iconButton } from './icons.js';
import type { Selection } from '../core/state.js';
export function workspaceToolbar(filters: HTMLElement[], actions: HTMLElement[]): HTMLElement {
  const toolbar = el('div', 'toolbar');
  const left = el('div', 'toolbar-filters'); left.setAttribute('role', 'group'); left.setAttribute('aria-label', 'Refresh and filter');
  const right = el('div', 'toolbar-actions'); right.setAttribute('role', 'group'); right.setAttribute('aria-label', 'Cleanup selection');
  left.append(...filters); right.append(...actions); toolbar.append(left, right);
  return toolbar;
}
export function searchInput(label: string): HTMLInputElement {
  const search = el('input');
  search.type = 'search';
  search.placeholder = label;
  search.setAttribute('aria-label', label);
  return search;
}
export function filterSelect<V extends string>(label: string, options: readonly (readonly [V, string])[]): HTMLSelectElement & { value: V } {
  const select = el('select');
  select.setAttribute('aria-label', label);
  for (const [value, text] of options) {
    const option = el('option', '', text);
    option.value = value;
    select.append(option);
  }
  return select as HTMLSelectElement & { value: V };
}
export type SelectAllControl = ReturnType<typeof selectionControl>;
export function selectionControl(selection: Selection, results: () => Set<string>, filtered: () => boolean, changed: () => void, blocked: () => boolean = () => false) {
  const header = el('div', 'list-selection');
  const choice = checkbox('Select all', selected => { selection.setMany(results(), selected); changed(); choice.input.focus({ preventScroll: true }); });
  header.append(choice.label);
  return { element: header, update() {
    const ids = results();
    const state = selection.summary(ids);
    choice.input.checked = ids.size > 0 && state.inResults === ids.size;
    choice.input.indeterminate = state.inResults > 0 && state.inResults < ids.size;
    choice.input.disabled = !ids.size || blocked();
    choice.label.querySelector('span')!.textContent = filtered() ? 'Select all results' : 'Select all';
    return state.outside ? `${selection.ids.size} selected · ${state.outside} outside results` : `${selection.ids.size} selected`;
  }};
}
/** Clear, count and "Clean up selected…" controls for a workspace toolbar. */
export function selectionActions(options: {
  selection: Selection;
  selectAll: SelectAllControl;
  /** Cleanup cannot start, e.g. while loading or another cleanup runs. */
  disabled: () => boolean;
  onClean: () => void;
  /** Called after the selection is cleared. */
  onClear: () => void;
}) {
  const count = el('span', 'selection-count', '0 selected');
  const clean = button('Clean up selected…', options.onClean, 'primary');
  clean.disabled = true;
  const clear = iconButton('clear', 'Clear selection', () => {
    options.selection.ids.clear();
    options.onClear();
  });
  clear.hidden = true;
  return {
    elements: [clear, count, clean],
    /** Refresh select-all state, the count and action availability. */
    update() {
      count.textContent = options.selectAll.update();
      clear.hidden = options.selection.ids.size === 0;
      clean.disabled = options.disabled() || !options.selection.ids.size;
    },
  };
}
