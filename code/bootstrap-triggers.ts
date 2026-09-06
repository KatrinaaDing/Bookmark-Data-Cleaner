declare const bootstrap: { Tooltip: new (element: Element) => object };
for (const element of document.querySelectorAll('[data-bs-toggle="tooltip"]')) new bootstrap.Tooltip(element);
export {};
