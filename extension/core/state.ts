export class Selection {
  readonly ids = new Set<string>();
  set(id: string, selected: boolean): void {
    if (selected) this.ids.add(id);
    else this.ids.delete(id);
  }
  retain(available: Set<string>): void {
    for (const id of this.ids) if (!available.has(id)) this.ids.delete(id);
  }
}
