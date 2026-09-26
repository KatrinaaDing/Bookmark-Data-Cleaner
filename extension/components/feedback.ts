import { button, el } from './dom.js';
import { icon, iconButton } from './icons.js';
import { enter, motionDuration, transition } from './motion.js';
let host: HTMLElement | undefined;
let serial = 0;
function toastHost(): HTMLElement {
  if (!host) {
    host = el('div', 'toast-host');
    host.popover = 'manual';
    const place = () => {
      if (!host?.childElementCount) return;
      const modal = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1);
      const parent = modal ?? document.body;
      if (host.parentElement !== parent) {
        host.hidePopover();
        parent.append(host);
        host.showPopover();
      }
    };
    new MutationObserver(place).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  const modal = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1);
  if (host.parentElement !== (modal ?? document.body)) {
    host.hidePopover();
    (modal ?? document.body).append(host);
  }
  if (!host.matches(':popover-open')) host.showPopover();
  return host;
}
export interface ToastHandle { dismiss(): void; }
export function toast(message: string | HTMLElement, kind: 'success' | 'error' | 'info' = 'success', options: { persistent?: boolean; busy?: boolean; className?: string } = {}): ToastHandle {
  const container = toastHost();
  const item = el('div', `toast toast-${kind}${options.persistent ? ' toast-persistent' : ''}${options.busy ? ' toast-progress' : ''}${options.className ? ` ${options.className}` : ''}`);
  const content = typeof message === 'string' ? el('span', '', message) : message;
  if (typeof message === 'string') content.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dismissing = false;
  const stop = () => clearTimeout(timer);
  const remove = () => {
    stop();
    item.remove();
    if (!container.childElementCount) container.hidePopover();
  };
  const dismiss = () => {
    if (dismissing) return;
    dismissing = true;
    stop();
    void transition(item, [{ opacity: 1 }, { opacity: 0 }], motionDuration('feedback')).then(remove);
  };
  const schedule = () => {
    stop();
    if (!options.persistent && kind !== 'error' && !item.matches(':hover, :focus-within')) timer = setTimeout(dismiss, 6000);
  };
  if (options.busy) {
    const spinner = el('span', 'spinner');
    spinner.setAttribute('aria-hidden', 'true');
    item.append(spinner);
  }
  item.append(content);
  if (!options.persistent) item.append(iconButton('close', 'Dismiss notification', dismiss));
  item.addEventListener('mouseenter', stop);
  item.addEventListener('mouseleave', schedule);
  item.addEventListener('focusin', stop);
  item.addEventListener('focusout', () => queueMicrotask(schedule));
  // Keep persistent errors; bound transient notification noise.
  const transient = container.querySelectorAll('.toast:not(.toast-error):not(.toast-persistent)');
  if (transient.length >= 3) transient[transient.length - 1].dispatchEvent(new Event('dismiss-toast'));
  item.addEventListener('dismiss-toast', dismiss);
  container.prepend(item);
  container.scrollTop = 0;
  enter(item, 1);
  schedule();
  return { dismiss: remove };
}

export function infoPopover(label: string, content: string): HTMLElement {
  const wrapper = el('span', 'info-control');
  const help = el('div', 'info-popover', content);
  help.id = `info-${++serial}`;
  help.popover = 'manual';
  help.setAttribute('role', 'tooltip');
  const control = el('span', 'detail-info');
  control.append(icon('info'));
  control.tabIndex = 0;
  control.setAttribute('role', 'img');
  control.setAttribute('aria-label', label);
  control.setAttribute('aria-describedby', help.id);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let watching: MutationObserver | undefined;
  function hide() {
    clearTimeout(timer);
    if (help.matches(':popover-open')) help.hidePopover();
    document.removeEventListener('keydown', escape, true);
    window.removeEventListener('resize', position);
    document.removeEventListener('scroll', position, true);
    watching?.disconnect();
  }
  function position() {
    const bounds = control.getBoundingClientRect();
    const width = Math.min(320, innerWidth - 32);
    help.style.width = `${width}px`;
    help.style.left = `${Math.min(innerWidth - width - 16, Math.max(16, bounds.left))}px`;
    help.style.top = `${Math.max(12, Math.min(innerHeight - help.offsetHeight - 12, bounds.bottom + 6))}px`;
  }
  function escape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hide();
  }
  function show() {
    clearTimeout(timer);
    if (!help.isConnected || help.matches(':popover-open')) return;
    help.showPopover();
    position();
    enter(help);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', position);
    document.addEventListener('scroll', position, true);
    watching = new MutationObserver(() => { if (!control.isConnected) hide(); });
    watching.observe(document.body, { childList: true, subtree: true });
  }
  const leave = () => { clearTimeout(timer); timer = setTimeout(() => { if (!wrapper.matches(':hover, :focus-within') && !help.matches(':hover')) hide(); }, 150); };
  control.addEventListener('mouseenter', show);
  control.addEventListener('focus', show);
  control.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') control.focus(); });
  control.addEventListener('mouseleave', leave);
  control.addEventListener('blur', leave);
  help.addEventListener('mouseenter', () => clearTimeout(timer));
  help.addEventListener('mouseleave', leave);
  wrapper.append(control, help);
  return wrapper;
}

export function unsavedChoice(): Promise<'save' | 'discard' | 'stay'> {
  return new Promise(resolve => {
    const dialog = el('dialog', 'unsaved-dialog');
    dialog.setAttribute('aria-labelledby', 'unsaved-title');
    dialog.append(el('h2', '', 'Save your changes?'));
    dialog.querySelector('h2')!.id = 'unsaved-title';
    dialog.append(el('p', 'muted', 'You have unsaved bookmark changes.'));
    let settled = false;
    const finish = (choice: 'save' | 'discard' | 'stay') => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(choice);
    };
    const actions = el('div', 'dialog-actions');
    const stay = button('Keep editing', () => finish('stay'), 'quiet');
    actions.append(stay, button('Discard', () => finish('discard'), 'quiet'), button('Save changes', () => finish('save'), 'primary'));
    dialog.append(actions);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish('stay'); });
    document.body.append(dialog);
    dialog.showModal();
    stay.focus();
    enter(dialog);
  });
}

/** Destructive confirmation shares the unsaved-dialog shell so drawer Escape handling stays paused. */
export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = el('dialog', 'unsaved-dialog confirm-dialog');
    const heading = el('h2', '', title);
    heading.id = `confirm-title-${++serial}`;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading, el('p', 'muted', message));
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(confirmed);
    };
    const actions = el('div', 'dialog-actions');
    const cancel = button('Cancel', () => finish(false), 'quiet');
    actions.append(cancel, button(confirmLabel, () => finish(true), 'danger'));
    dialog.append(actions);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
    enter(dialog);
  });
}
