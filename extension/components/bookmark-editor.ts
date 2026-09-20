import { saveBookmark, updateBookmark } from '../browser/bookmarks.js';
import type { BookmarkFolder, BookmarkRef } from '../core/types.js';
import { errorMessage, webOrigin } from '../helpers/sites.js';
import { el, status } from './dom.js';
import { actionButton } from './action-button.js';
import { activateForm, formSession, requestLeave, type FormSession } from './form-session.js';
import { toast } from './feedback.js';

export interface BookmarkMutation { id?: string; created: boolean; error?: string; }
export interface BookmarkEditor { element: HTMLFormElement; session: FormSession; open(): void; }
export function bookmarkEditor(options: {
  bookmark?: BookmarkRef;
  folders: BookmarkFolder[];
  title: string;
  url: string;
  parentId?: string;
  onClose: () => void;
  onSettled: (result: BookmarkMutation) => Promise<void> | void;
}): BookmarkEditor {
  const form = el('form', 'bookmark-editor');
  const title = el('input'); title.name = 'title'; title.value = options.title;
  const url = el('input'); url.name = 'url'; url.type = 'url'; url.required = true; url.value = options.url;
  const folder = el('select'); folder.name = 'parentId'; folder.required = true;
  for (const item of options.folders) {
    const choice = el('option', '', item.path || item.title || 'Bookmarks');
    choice.value = item.id; choice.disabled = !!item.unmodifiable;
    choice.selected = item.id === (options.bookmark?.parentId ?? options.parentId);
    folder.append(choice);
  }
  if (!folder.value || folder.selectedOptions[0]?.disabled) folder.value = options.folders.find(item => !item.unmodifiable)?.id ?? '';
  for (const [label, input] of [['Bookmark title', title], ['Address', url], ['Save in', folder]] as const) {
    const field = el('label', '', label); field.append(input); form.append(field);
  }
  const feedback = el('div', 'editor-feedback');
  const actions = el('div', 'form-actions');
  const cancel = actionButton('Cancel changes', () => { void requestLeave(); }, { icon: 'close', tone: 'negative' });
  const submit = actionButton(options.bookmark ? 'Save changes' : 'Create bookmark copy', () => {}, { icon: 'check', tone: 'positive', submit: true });
  actions.append(cancel.element, submit.element); form.append(feedback, actions);
  let writing = false;
  // A committed mutation must never be replayed because refreshing the view failed.
  let committed: BookmarkMutation | undefined;
  const values = () => ({ title: title.value, url: url.value, parentId: folder.value });
  const writable = () => !options.bookmark?.unmodifiable && !!folder.value;
  function update() {
    for (const input of [title, url, folder]) input.disabled = writing || !!committed;
    cancel.update({ disabled: writing });
    submit.update({ pending: writing, pendingLabel: committed ? 'Refreshing saved bookmark…' : 'Saving bookmark…', disabled: !writable() || (!committed && !!options.bookmark && !session.dirty()) });
    form.setAttribute('aria-busy', String(writing));
  }
  const session = formSession({ element: form, values, close: options.onClose, save: async () => {
    if (!writable() || (!committed && options.bookmark && !session.dirty())) return false;
    if (!committed && (!form.reportValidity() || !webOrigin(url.value))) {
      feedback.replaceChildren(status('Enter an HTTP or HTTPS URL.')); url.focus(); return false;
    }
    writing = true; update();
    feedback.replaceChildren(status(committed ? 'Refreshing the saved bookmark…' : 'Saving bookmark…', true));
    try {
      if (!committed) {
        try {
          const saved = options.bookmark
            ? await updateBookmark(options.bookmark.id, values())
            : await saveBookmark(title.value, url.value, folder.value);
          committed = { id: saved.id, created: !options.bookmark };
        } catch (error) {
          const message = errorMessage(error);
          // Updates can succeed before a move fails. Refresh the lists without replacing this draft.
          try { await options.onSettled({ id: options.bookmark?.id, created: false, error: message }); } catch { /* Retain the draft and error. */ }
          throw Error(`${message}${options.bookmark ? ' Some changes may already be saved. Review the values before retrying.' : ''}`);
        }
      }
      try { await options.onSettled(committed); }
      catch { throw Error('The bookmark was saved, but the list could not refresh. Use the check button to retry refreshing; it will not create another copy.'); }
      toast(committed.created ? 'Bookmark copy created.' : 'Bookmark changes saved.');
      session.close();
      return true;
    } catch (error) {
      const message = errorMessage(error);
      feedback.replaceChildren(status(message)); toast(message, 'error');
      return false;
    } finally { writing = false; update(); }
  }});
  form.addEventListener('input', update); form.addEventListener('change', update);
  form.addEventListener('submit', event => { event.preventDefault(); void session.submit(); });
  if (!writable()) feedback.append(status('No writable bookmark destination available. Refresh after creating a folder in your browser.'));
  update();
  return { element: form, session, open: () => { activateForm(session); title.focus(); } };
}
