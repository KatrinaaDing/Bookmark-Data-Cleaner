import { actionButton } from './action-button.js';
import { PendingAction } from './async-state.js';
import { toast } from './feedback.js';
import type { IconName } from './icons.js';
/** Shared request feedback; the caller keeps permission-specific inventory behavior. */
export function permissionAction(options: {
  label: string;
  icon?: IconName;
  request: () => Promise<boolean>;
  granted: string;
  declined: string;
  onGranted: () => Promise<void> | void;
}): HTMLButtonElement {
  const pending = new PendingAction();
  const control = actionButton(options.label, () => {
    void pending.run(async () => {
      control.update({ pending: true, pendingLabel: 'Waiting for permission…' });
      try {
        const granted = await options.request();
        toast(granted ? options.granted : options.declined, granted ? 'success' : 'info');
        if (granted) { control.element.hidden = true; await options.onGranted(); }
      } catch { toast('Could not request access. Try again.', 'error'); }
      finally { control.update({ pending: false }); }
    });
  }, { icon: options.icon, tone: options.icon ? 'quiet' : 'primary' });
  return control.element;
}
