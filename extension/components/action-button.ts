import { button, el } from './dom.js';
import { icon, type IconName } from './icons.js';
export type ActionTone = 'primary' | 'quiet' | 'danger' | 'positive' | 'negative';
export function actionButton(label: string, action: () => void, options: { icon?: IconName; tone?: ActionTone; submit?: boolean } = {}) {
  const element = button('', action, options.tone ?? 'quiet');
  const content = el('span', 'action-content');
  if (options.icon) {
    element.classList.add('icon-button');
    content.append(icon(options.icon));
    element.title = label;
  } else content.textContent = label;
  element.setAttribute('aria-label', label);
  element.type = options.submit ? 'submit' : 'button';
  element.append(content);
  return {
    element,
    update({ pending = false, disabled = false, pendingLabel = label }: { pending?: boolean; disabled?: boolean; pendingLabel?: string }) {
      element.disabled = pending || disabled;
      element.setAttribute('aria-busy', String(pending));
      element.setAttribute('aria-label', pending ? pendingLabel : label);
      content.hidden = pending;
      element.querySelector('.spinner')?.remove();
      if (pending) element.append(el('span', 'spinner'));
      element.classList.toggle('is-pending', pending);
    },
  };
}
