import { PendingAction } from './async-state.js';
import { unsavedChoice } from './feedback.js';
export interface FormSession {
  element: HTMLFormElement;
  dirty(): boolean;
  pending(): boolean;
  submit(): Promise<boolean>;
  close(): void;
}
let active: FormSession | undefined;
let leaving: Promise<boolean> | undefined;
export function currentForm(): FormSession | undefined {
  if (active && !active.element.isConnected) active = undefined;
  return active;
}
export function activateForm(session: FormSession): void { active = session; }
export function releaseForm(session: FormSession): void { if (active === session) active = undefined; }
export function requestLeave(): Promise<boolean> {
  if (leaving) return leaving;
  const session = currentForm();
  if (!session) return Promise.resolve(true);
  if (session.pending()) return Promise.resolve(false);
  leaving = (async () => {
    if (!session.dirty()) { session.close(); return true; }
    const choice = await unsavedChoice();
    if (choice === 'stay') { session.element.querySelector('input')?.focus(); return false; }
    if (choice === 'save' && !(await session.submit())) return false;
    session.close();
    return true;
  })().finally(() => { leaving = undefined; });
  return leaving;
}
window.addEventListener('beforeunload', event => {
  const session = currentForm();
  if (session && (session.dirty() || session.pending())) {
    event.preventDefault();
    event.returnValue = '';
  }
});

/** Draft comparison is shared by edit and copy; browser mutations remain in the adapter. */
export function formSession(options: {
  element: HTMLFormElement;
  values: () => unknown;
  save: () => Promise<boolean>;
  close: () => void;
}): FormSession {
  let baseline = JSON.stringify(options.values());
  const action = new PendingAction();
  const session: FormSession = {
    element: options.element,
    dirty: () => JSON.stringify(options.values()) !== baseline,
    pending: () => action.pending,
    submit: async () => (await action.run(async () => {
      const success = await options.save();
      if (success) baseline = JSON.stringify(options.values());
      return success;
    })) ?? false,
    close: () => { releaseForm(session); options.close(); },
  };
  return session;
}
