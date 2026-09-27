import { cancelTransition, motionDuration, prefersReducedMotion, transition } from "./motion.js";
import { on } from "./events.js";
import { el, spinner } from "./dom.js";
import { requestLeave } from "./form-session.js";
import { iconButton } from "./icons.js";

export interface DetailsDrawer {
  open(content: HTMLElement, trigger: HTMLElement): number;
  update(content: HTMLElement, request: number): void;
  isOpen(key?: string): boolean;
  close(): void;
  syncInspection(): void;
  setCleanupBusy(busy: boolean): void;
}

let shared: DetailsDrawer | undefined;
/** Dialogs stacked above details own Escape and must not be displaced by a mode change. */
const OVERLYING_DIALOGS = "dialog.cleanup-dialog[open], dialog.unsaved-dialog[open]";

/** Mark only the row for `key` as the inspected one. */
function highlightInspected(key?: string): void {
  document
    .querySelectorAll('[data-focus-key][aria-current="true"]')
    .forEach((node) => node.removeAttribute("aria-current"));
  if (key) document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`)?.setAttribute("aria-current", "true");
}

export function detailsDrawer(): DetailsDrawer {
  if (shared) return shared;
  const dialog = el("dialog", "details-drawer");
  dialog.setAttribute("aria-label", "Site details");
  const body = el("div", "drawer-content");
  const cleanupOverlay = el("div", "drawer-cleanup-overlay");
  const cleanupMessage = el("div", "drawer-cleanup-message");
  cleanupMessage.append(spinner(), el("span", "", "Cleanup in progress…"));
  cleanupOverlay.append(cleanupMessage);
  cleanupOverlay.hidden = true;
  let request = 0;
  let trigger: HTMLElement | undefined;
  let motionRevision = 0;
  let opened = false;
  let modal = false;
  let closing = false;
  const closeButton = iconButton("close", "Close details", close);
  const header = el("div", "drawer-header");
  header.append(closeButton);
  dialog.append(header, body, cleanupOverlay);
  const rail = el("div", "details-rail");
  rail.append(dialog);

  const wantsModal = () => matchMedia("(max-width: 760px)").matches;

  function markInspected(source?: HTMLElement) {
    highlightInspected();
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
    motionRevision++;
    cancelTransition(dialog);
    if (dialog.open) dialog.close();
    markInspected();
    opened = false;
    closing = false;
    setCleanupBusy(false);
    rail.closest(".workspace")?.classList.remove("has-details");
    rail.remove();
    if (restoreFocus) returnFocus();
  }

  function close() { void requestLeave().then(allowed => { if (allowed) closeNow(); }); }

  function setCleanupBusy(busy: boolean) {
    cleanupOverlay.hidden = !busy;
    body.inert = busy;
    dialog.classList.toggle("is-cleaning", busy);
    dialog.setAttribute("aria-busy", String(busy));
    if (busy && body.contains(document.activeElement)) closeButton.focus({ preventScroll: true });
  }

  function closeNow() {
    if (!opened || closing) return;
    request++;
    closing = true;
    rail.closest(".workspace")?.classList.remove("has-details");
    cancelTransition(dialog);
    if (modal || prefersReducedMotion()) {
      finishClose();
      return;
    }
    const current = ++motionRevision;
    void transition(dialog,
      [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(calc(100% + 20px))", opacity: 0 }],
      motionDuration("panel"),
    ).then(() => { if (current === motionRevision && closing) finishClose(); });
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
      !document.querySelector(OVERLYING_DIALOGS)
    ) {
      event.preventDefault();
      close();
    }
  });
  function updatePresentation() {
    if (!opened || closing || wantsModal() === modal) return;
    // A responsive transition must not move the underlying drawer above review.
    if (document.querySelector(OVERLYING_DIALOGS)) return;
    present();
    closeButton.focus({ preventScroll: true });
  }
  window.addEventListener("resize", updatePresentation);
  document.addEventListener("close", () => queueMicrotask(updatePresentation), true);
  on("workspace-route", () => {
    request++;
    if (opened) finishClose(false);
  });

  shared = {
    open(content, source) {
      request++;
      trigger = source;
      closing = false;
      cancelTransition(dialog);
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
      motionRevision++;
      if (!alreadyOpen && !prefersReducedMotion() && !modal)
        void transition(dialog,
          [{ transform: "translateX(calc(100% + 20px))", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
          motionDuration("panel"),
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
    syncInspection() {
      const key = dialog.dataset.inspectionKey;
      if (!opened || closing || !key) return;
      highlightInspected(key);
    },
    setCleanupBusy,
  };
  return shared;
}
