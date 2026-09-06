import { button } from "./dom.js";
const paths = {
  close: ["M6 6l12 12M18 6L6 18"],
  refresh: [
    "M20 7v5h-5",
    "M4 17v-5h5",
    "M6 6a8 8 0 0 1 13 3l1 3M4 12l1 3a8 8 0 0 0 13 3",
  ],
  info: ["M12 17v-5M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"],
  history: ["M3 4v5h5", "M3 9a9 9 0 1 1 0 6", "M12 7v5l3 2"],
  select: [
    "M9 11l3 3L22 4",
    "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  ],
  clear: [
    "M9 9l6 6M15 9l-6 6",
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2",
  ],
  bookmark: ["M6 3h12v18l-6-4-6 4V3"],
} as const;
export type IconName = keyof typeof paths;
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(key, value);
  for (const data of paths[name]) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", data);
    svg.append(path);
  }
  svg.classList.add("icon");
  return svg;
}
export function iconButton(
  name: IconName,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const control = button("", action, "icon-button");
  control.append(icon(name));
  control.setAttribute("aria-label", label);
  control.title = label;
  return control;
}
