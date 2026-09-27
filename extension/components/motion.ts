const preference = matchMedia('(prefers-reduced-motion: reduce)');
export function prefersReducedMotion(): boolean { return preference.matches; }
const active = new Map<HTMLElement, Animation>();
preference.addEventListener('change', () => {
  if (preference.matches) for (const animation of active.values()) animation.finish();
});
export function motionDuration(kind: 'feedback' | 'reveal' | 'panel'): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--motion-${kind}`)) || 0;
}
export function cancelTransition(element: HTMLElement): void { active.get(element)?.cancel(); }
export async function transition(element: HTMLElement, frames: Keyframe[], duration = motionDuration('reveal')): Promise<void> {
  active.get(element)?.cancel();
  if (preference.matches || !element.isConnected) return;
  const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.16,1,.3,1)' });
  active.set(element, animation);
  try { await animation.finished; } catch { /* A newer transition owns the element. */ }
  finally { if (active.get(element) === animation) active.delete(element); }
}
export function enter(element: HTMLElement, direction = 0): void {
  void transition(element, [{ opacity: .4, transform: `translateX(${direction * 8}px)` }, { opacity: 1, transform: 'translateX(0)' }]);
}
export async function reveal(element: HTMLElement, open: boolean): Promise<void> {
  element.inert = !open;
  if (open) element.hidden = false;
  const height = element.getBoundingClientRect().height;
  element.style.overflow = 'hidden';
  await transition(element, open
    ? [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }]
    : [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }], motionDuration('reveal'));
  if (element.inert === !open) {
    element.hidden = !open;
    element.style.overflow = '';
  }
}
