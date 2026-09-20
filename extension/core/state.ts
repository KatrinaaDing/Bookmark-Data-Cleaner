export class Selection {
  readonly ids = new Set<string>();
  set(id: string, selected: boolean): void {
    if (selected) this.ids.add(id);
    else this.ids.delete(id);
  }
  setMany(ids: Iterable<string>, selected: boolean): void {
    for (const id of ids) this.set(id, selected);
  }
  summary(results: ReadonlySet<string>): { inResults: number; outside: number } {
    let inResults = 0;
    for (const id of this.ids) if (results.has(id)) inResults++;
    return { inResults, outside: this.ids.size - inResults };
  }
  retain(available: Set<string>): void {
    for (const id of this.ids) if (!available.has(id)) this.ids.delete(id);
  }
}
