import { el } from "./dom.js";
import { iconButton } from "./icons.js";
export interface DetailsDrawer {
  open(content: HTMLElement, trigger: HTMLElement): number;
  update(content: HTMLElement, request: number): void;
  close(): void;
}
let shared: DetailsDrawer | undefined;
export function detailsDrawer(): DetailsDrawer {
  if (shared) return shared;
  const dialog = el("dialog", "details-drawer");
  dialog.setAttribute("aria-label", "Site details");
  const body = el("div", "drawer-content");
  let request = 0,
    trigger: HTMLElement | undefined,
    motion: Animation | undefined,
    closing = false;
  const closeButton = iconButton("close", "Close details", close);
  const header = el("div", "drawer-header");
  header.append(closeButton);
  dialog.append(header, body);
  document.body.append(dialog);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function finishClose() {
    const finished = motion;
    motion = undefined;
    dialog.close();
    finished?.cancel();
    closing = false;
    document.documentElement.classList.remove("drawer-open");
    const key = trigger?.dataset.focusKey;
    const replacement = key
      ? document.querySelector<HTMLElement>(
          `[data-focus-key="${CSS.escape(key)}"]`,
        )
      : undefined;
    const target = trigger?.isConnected ? trigger : replacement;
    if (target && !target.closest("[hidden]"))
      target.focus({ preventScroll: true });
    else document.getElementById("content")?.focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open || closing) return;
    request++;
    closing = true;
    motion?.cancel();
    if (reduced()) {
      finishClose();
      return;
    }
    motion = dialog.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: "translateX(calc(100% + 20px))", opacity: 0 },
      ],
      { duration: 160, easing: "ease-in", fill: "forwards" },
    );
    motion.onfinish = finishClose;
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      close();
  });
  window.addEventListener("hashchange", () => {
    request++;
    motion?.cancel();
    if (dialog.open) {
      finishClose();
      document.getElementById("content")?.focus({ preventScroll: true });
    }
  });
  shared = {
    open(content, source) {
      request++;
      trigger = source;
      closing = false;
      motion?.cancel();
      body.replaceChildren(content);
      dialog.scrollTop = 0;
      const alreadyOpen = dialog.open;
      if (!alreadyOpen) {
        document.documentElement.classList.add("drawer-open");
        dialog.showModal();
        closeButton.focus({ preventScroll: true });
      }
      if (!alreadyOpen && !reduced())
        motion = dialog.animate(
          [
            { transform: "translateX(calc(100% + 20px))", opacity: 0 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      return request;
    },
    update(content, token) {
      if (token === request && dialog.open && !closing)
        body.replaceChildren(content);
    },
    close,
  };
  return shared;
}
