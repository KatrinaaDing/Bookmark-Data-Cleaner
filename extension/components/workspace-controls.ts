import { checkbox, el } from './dom.js';
import type { Selection } from '../core/state.js';
export function workspaceToolbar(filters: HTMLElement[], actions: HTMLElement[]): HTMLElement {
  const toolbar = el('div', 'toolbar');
  const left = el('div', 'toolbar-filters'); left.setAttribute('role', 'group'); left.setAttribute('aria-label', 'Refresh and filter');
  const right = el('div', 'toolbar-actions'); right.setAttribute('role', 'group'); right.setAttribute('aria-label', 'Cleanup selection');
  left.append(...filters); right.append(...actions); toolbar.append(left, right);
  return toolbar;
}
export function selectionControl(selection: Selection, results: () => Set<string>, filtered: () => boolean, changed: () => void) {
  const header = el('div', 'list-selection');
  const choice = checkbox('Select all', selected => { selection.setMany(results(), selected); changed(); });
  header.append(choice.label);
  return { element: header, update() {
    const ids = results();
    const state = selection.summary(ids);
    choice.input.checked = ids.size > 0 && state.inResults === ids.size;
    choice.input.indeterminate = state.inResults > 0 && state.inResults < ids.size;
    choice.input.disabled = !ids.size;
    choice.label.querySelector('span')!.textContent = filtered() ? 'Select all results' : 'Select all';
    return state.outside ? `${selection.ids.size} selected · ${state.outside} outside results` : `${selection.ids.size} selected`;
  }};
}
