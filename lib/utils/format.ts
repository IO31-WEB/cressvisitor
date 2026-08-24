export function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Formats a 0-24 decimal hour (e.g. 9.5) as a clock time (e.g. "9:30 AM").
 * Used for a cluster's avgArrivalHour, which has no associated date — a
 * single representative time-of-day, not a specific day's timestamp. */
export function formatHourOfDay(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.round((hour - Math.floor(hour)) * 60);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}
