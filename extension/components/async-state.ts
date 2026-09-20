/** Excludes repeated writes. Disposing a view must never be treated as cancelling a write. */
export class PendingAction {
  pending = false;
  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try { return await operation(); }
    finally { this.pending = false; }
  }
}

/** Invalidates read results without pretending to cancel underlying browser work. */
export class LatestRead {
  private revision = 0;
  begin(): () => boolean {
    const revision = ++this.revision;
    return () => revision === this.revision;
  }
  invalidate(): void { this.revision++; }
}
