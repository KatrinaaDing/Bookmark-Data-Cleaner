import { cancelTransition, motionDuration, transition } from "./motion.js";
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  if (node instanceof HTMLDetailsElement) animateDisclosure(node);
  return node;
}
export function button(
  text: string,
  action: () => void,
  className = "",
): HTMLButtonElement {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
export function checkbox(
  text: string,
  change: (checked: boolean) => void,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = el("label", "check");
  const input = el("input");
  input.type = "checkbox";
  input.addEventListener("change", () => change(input.checked));
  label.append(input, el("span", "", text));
  return { label, input };
}
export function status(text: string, busy = false): HTMLElement {
  const node = el("p", "status", text);
  node.setAttribute("role", "status");
  if (busy) {
    node.prepend(el("span", "spinner"));
    node.setAttribute("aria-busy", "true");
  }
  return node;
}
export function heading(title: string, description = ""): HTMLElement {
  const node = el("header", "page-heading");
  node.append(el("h1", "", title));
  if (description) node.append(el("p", "muted", description));
  return node;
}
export function dateText(time?: number): string {
  return time
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(time)
    : "No matching history";
}

export function disclosure(label: string, text: string): HTMLDetailsElement {
  const details = el("details", "help-disclosure");
  details.append(el("summary", "", label), el("p", "fine", text));
  return details;
}

// Keep native summary keyboard behavior while animating both directions.
function animateDisclosure(details: HTMLDetailsElement): void {
  let moving = false;
  let target = details.open;
  let revision = 0;
  details.addEventListener("click", event => {
    if (!(event.target instanceof Element) || !event.target.closest("summary") || event.target.closest("details") !== details) return;
    event.preventDefault();
    const start = details.getBoundingClientRect().height;
    if (!moving) target = details.open;
    target = !target;
    const current = ++revision;
    cancelTransition(details);
    details.open = target;
    const end = details.getBoundingClientRect().height;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      details.style.overflow = ""; moving = false; return;
    }
    moving = true;
    details.open = true;
    details.style.overflow = "hidden";
    void transition(details, [{ height: `${start}px` }, { height: `${end}px` }], motionDuration("reveal")).then(() => {
      if (current !== revision) return;
      details.open = target;
      details.style.overflow = "";
      moving = false;
    });
  });
}

/** Forward empty row space to its native button, preserving independent controls. */
export function clickableRow(row: HTMLElement, action: HTMLButtonElement): void {
  // Lists can be rebuilt while the same site remains open for inspection.
  const inspected = document.querySelector<HTMLElement>(".details-drawer")?.dataset.inspectionKey;
  if (inspected && inspected === action.dataset.focusKey) action.setAttribute("aria-current", "true");
  row.addEventListener("click", (event) => {
    if (event.target instanceof Element &&
        !event.target.closest("button, input, label, a, select, textarea")) action.click();
  });
}
