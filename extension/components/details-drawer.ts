import { el } from "./dom.js";
import { iconButton } from "./icons.js";

export interface DetailsDrawer {
  open(content: HTMLElement, trigger: HTMLElement): number;
  update(content: HTMLElement, request: number): void;
  isOpen(key?: string): boolean;
  close(): void;
}

let shared: DetailsDrawer | undefined;

export function detailsDrawer(): DetailsDrawer {
  if (shared) return shared;
  const dialog = el("dialog", "details-drawer");
  dialog.setAttribute("aria-label", "Site details");
  const body = el("div", "drawer-content");
  let request = 0;
  let trigger: HTMLElement | undefined;
  let motion: Animation | undefined;
  let opened = false;
  let modal = false;
  let closing = false;
  const closeButton = iconButton("close", "Close details", close);
  const header = el("div", "drawer-header");
  header.append(closeButton);
  dialog.append(header, body);
  const rail = el("div", "details-rail");
  rail.append(dialog);

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wantsModal = () => matchMedia("(max-width: 760px)").matches;

  function markInspected(source?: HTMLElement) {
    document
      .querySelectorAll('[data-focus-key][aria-current="true"]')
      .forEach((node) => node.removeAttribute("aria-current"));
    if (source?.dataset.focusKey) {
      dialog.dataset.inspectionKey = source.dataset.focusKey;
      source.setAttribute("aria-current", "true");
    } else delete dialog.dataset.inspectionKey;
  }

  function present() {
    const nextModal = wantsModal();
    if (dialog.open) dialog.close();
    modal = nextModal;
    if (modal) dialog.showModal();
    else dialog.show();
    dialog.dataset.mode = modal ? "modal" : "panel";
  }

  function visible(node?: HTMLElement | null): node is HTMLElement {
    return !!node && node.isConnected && !node.closest("[hidden], [inert]") && node.checkVisibility();
  }

  function returnFocus() {
    const key = trigger?.dataset.focusKey;
    const replacement = key
      ? document.querySelector<HTMLElement>(
          `[data-focus-key="${CSS.escape(key)}"]`,
        )
      : undefined;
    const fallback = document.querySelector<HTMLElement>(
      "section:not([hidden]) .workspace-list .row-title:not([inert] *)",
    ) ?? undefined;
    const target = visible(replacement)
      ? replacement
      : visible(trigger)
        ? trigger
        : fallback;
    (target ?? document.getElementById("content"))?.focus({ preventScroll: true });
  }

  function finishClose(restoreFocus = true) {
    motion?.cancel();
    motion = undefined;
    if (dialog.open) dialog.close();
    markInspected();
    opened = false;
    closing = false;
    rail.closest(".workspace")?.classList.remove("has-details");
    rail.remove();
    if (restoreFocus) returnFocus();
  }

  function close() {
    if (!opened || closing) return;
    request++;
    closing = true;
    rail.closest(".workspace")?.classList.remove("has-details");
    motion?.cancel();
    if (modal || reduced()) {
      finishClose();
      return;
    }
    motion = dialog.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: "translateX(calc(100% + 20px))", opacity: 0 },
      ],
      { duration: 240, easing: "ease-in", fill: "forwards" },
    );
    motion.onfinish = () => finishClose();
  }

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      opened &&
      !modal &&
      !document.querySelector("dialog.cleanup-dialog[open]")
    ) {
      event.preventDefault();
      close();
    }
  });
  window.addEventListener("resize", () => {
    if (!opened || closing || wantsModal() === modal) return;
    present();
    closeButton.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", () => {
    request++;
    if (opened) finishClose(false);
  });

  shared = {
    open(content, source) {
      request++;
      trigger = source;
      closing = false;
      motion?.cancel();
      body.replaceChildren(content);
      dialog.scrollTop = 0;
      const workspace = source.closest(".workspace");
      if (!workspace) return request;
      if (rail.parentElement !== workspace) workspace.append(rail);
      workspace.classList.add("has-details");
      markInspected(source);
      const alreadyOpen = opened;
      opened = true;
      present();
      if (!alreadyOpen && !reduced() && !modal)
        motion = dialog.animate(
          [
            { transform: "translateX(calc(100% + 20px))", opacity: 0 },
            { transform: "translateX(0)", opacity: 1 },
          ],
          { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      closeButton.focus({ preventScroll: true });
      return request;
    },
    update(content, token) {
      if (token === request && opened && !closing) body.replaceChildren(content);
    },
    isOpen(key) {
      return (
        opened &&
        !closing &&
        (!key || dialog.dataset.inspectionKey === key)
      );
    },
    close,
  };
  return shared;
}
