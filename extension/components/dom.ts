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
  let motion: Animation | undefined;
  let target = details.open;
  details.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("summary")) return;
    if (event.target.closest("details") !== details) return;
    event.preventDefault();
    const start = details.getBoundingClientRect().height;
    if (!motion) target = details.open;
    target = !target;
    motion?.cancel();
    motion = undefined;
    details.open = target;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = details.getBoundingClientRect().height;
    details.open = true;
    details.style.overflow = "hidden";
    motion = details.animate([{ height: `${start}px` }, { height: `${end}px` }], {
      duration: 220, easing: "cubic-bezier(.2,.8,.2,1)",
    });
    motion.onfinish = () => {
      details.open = target;
      details.style.overflow = "";
      motion = undefined;
    };
  });
}

/** Forward empty row space to its native button, preserving independent controls. */
export function clickableRow(row: HTMLElement, action: HTMLButtonElement): void {
  row.addEventListener("click", (event) => {
    if (event.target instanceof Element &&
        !event.target.closest("button, input, label, a, select, textarea")) action.click();
  });
}
