export function devTrace(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
}

export function devTraceError(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.error(...args);
  }
}
