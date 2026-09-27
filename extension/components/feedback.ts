import { button, el, spinner } from './dom.js';
import { icon, iconButton } from './icons.js';
import { enter, motionDuration, transition } from './motion.js';
let host: HTMLElement | undefined;
let serial = 0;
/** Toasts must sit in the top modal dialog, if any, to stay visible and reachable. */
function placeToastHost(container: HTMLElement): boolean {
  const parent = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1) ?? document.body;
  if (container.parentElement === parent) return false;
  container.hidePopover();
  parent.append(container);
  return true;
}
function toastHost(): HTMLElement {
  if (!host) {
    const container = host = el('div', 'toast-host');
    container.popover = 'manual';
    new MutationObserver(() => {
      if (container.childElementCount && placeToastHost(container)) container.showPopover();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  placeToastHost(host);
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
  if (options.busy) item.append(spinner());
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

interface DialogChoice<T> { label: string; value: T; tone: 'quiet' | 'primary' | 'danger'; focus?: boolean; }

/**
 * Small modal choice. Both uses share the unsaved-dialog class so drawer Escape
 * handling stays paused while they are open. Escape resolves to `dismissed`.
 */
function choiceDialog<T>(options: { className: string; title: string; message: string; choices: DialogChoice<T>[]; dismissed: T }): Promise<T> {
  return new Promise(resolve => {
    const dialog = el('dialog', `unsaved-dialog ${options.className}`.trim());
    const heading = el('h2', '', options.title);
    heading.id = `dialog-title-${++serial}`;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.append(heading, el('p', 'muted', options.message));
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const actions = el('div', 'dialog-actions');
    let initial: HTMLButtonElement | undefined;
    for (const choice of options.choices) {
      const control = button(choice.label, () => finish(choice.value), choice.tone);
      if (choice.focus) initial = control;
      actions.append(control);
    }
    dialog.append(actions);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(options.dismissed); });
    document.body.append(dialog);
    dialog.showModal();
    initial?.focus();
    enter(dialog);
  });
}

export function unsavedChoice(): Promise<'save' | 'discard' | 'stay'> {
  return choiceDialog({
    className: '',
    title: 'Save your changes?',
    message: 'You have unsaved bookmark changes.',
    dismissed: 'stay',
    choices: [
      { label: 'Keep editing', value: 'stay', tone: 'quiet', focus: true },
      { label: 'Discard', value: 'discard', tone: 'quiet' },
      { label: 'Save changes', value: 'save', tone: 'primary' },
    ],
  });
}

export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return choiceDialog({
    className: 'confirm-dialog',
    title,
    message,
    dismissed: false,
    choices: [
      { label: 'Cancel', value: false, tone: 'quiet', focus: true },
      { label: confirmLabel, value: true, tone: 'danger' },
    ],
  });
}
