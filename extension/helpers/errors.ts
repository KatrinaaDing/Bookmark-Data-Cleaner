export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed. Please retry.";
}
