import { format, isThisYear, isToday, isYesterday } from "date-fns";

export function dateGroupLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "EEEE, MMMM d");
  return format(date, "MMMM d, yyyy");
}

export function timeLabel(timestampMs: number): string {
  return format(new Date(timestampMs), "h:mm a");
}

/** Renders a fixed-width dot mask instead of the real length, so the mask itself doesn't leak how long the secret is. */
export function maskSecret(): string {
  return "•".repeat(28);
}
