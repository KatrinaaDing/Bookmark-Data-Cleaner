import { button } from "./dom.js";
const paths = {
  edit: ["M15 4l5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6"],
  copy: ["M9 9h12v12H9z", "M15 5V3H3v12h2"],
  check: ["M5 12l4 4L19 6"],
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
  cookie: ["M21 12a9 9 0 1 1-9-9 4 4 0 0 0 4 4 5 5 0 0 0 5 5Z", "M8 8h.01M7 14h.01M12 17h.01M14 11h.01"],
  broom: [
    "M10 10V4a2 2 0 0 1 4 0v6",
    "M6 10h12a2 2 0 0 1 2 2v2H4v-2a2 2 0 0 1 2-2",
    "M4.5 14 3 22h18l-1.5-8",
    "M9 22l.75-3.5M15 22l-.75-3.5",
  ],
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
