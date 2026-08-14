import { formatDistanceToNowStrict, format } from "date-fns";

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return `${formatDistanceToNowStrict(value)} ago`;
}

export function formatTimestamp(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";
  return format(value, "MMM d, h:mm a");
}

export function formatClock(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return format(value, "HH:mm");
}

export function dayLabel(date: Date | string, now = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return format(value, "MMMM d");
}
