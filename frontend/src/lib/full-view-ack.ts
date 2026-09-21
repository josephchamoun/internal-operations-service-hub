const WINDOW_MS = 60 * 60 * 1000;

export function isWithinFullViewWindow(
  lastFullAccessAt?: string | null,
): boolean {
  if (!lastFullAccessAt) return false;
  const at = new Date(lastFullAccessAt).getTime();
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < WINDOW_MS;
}
