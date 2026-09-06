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
  const dialog = el("aside", "details-drawer");
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
  const rail = el("div", "details-rail");
  rail.append(dialog);
  let opened = false;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function finishClose() {
    const finished = motion;
    motion = undefined;
    opened = false;
    rail.remove();
    finished?.cancel();
    closing = false;
    document.querySelector(".workspace.has-details")?.classList.remove("has-details");
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
    if (!opened || closing) return;
    request++;
    closing = true;
    rail.closest(".workspace")?.classList.remove("has-details");
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
      { duration: 240, easing: "ease-in", fill: "forwards" },
    );
    motion.onfinish = finishClose;
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && opened && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      close();
    }
  });
  window.addEventListener("hashchange", () => {
    request++;
    motion?.cancel();
    if (opened) {
      finishClose();
      document.getElementById("content")?.focus({ preventScroll: true });
    }
  });
  shared = {
    open(content, source) {
      request++;
      trigger = source;
      closing = false;
      rail.closest(".workspace")?.classList.add("has-details");
      motion?.cancel();
      body.replaceChildren(content);
      dialog.scrollTop = 0;
      const alreadyOpen = opened;
      if (!alreadyOpen) {
        const workspace = source.closest(".workspace");
        if (!workspace) return request;
        workspace.append(rail);
        void rail.offsetWidth;
        workspace.classList.add("has-details");
        opened = true;
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
      if (token === request && opened && !closing)
        body.replaceChildren(content);
    },
    close,
  };
  return shared;
}
