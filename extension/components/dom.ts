export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
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
