/** "1 bookmark", "2 bookmarks"; irregular plurals pass their own form. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function dateText(time?: number): string {
  return time
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(time)
    : "No matching history";
}
