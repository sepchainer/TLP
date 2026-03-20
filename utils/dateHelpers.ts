export const getIsoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().split('T')[0];
};

export const formatGermanDate = (date: Date) => {
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
};

export function parseIsoDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function formatHistoryDate(dateStr: string): string {
  const normalized = parseIsoDate(dateStr);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (normalized.toDateString() === today.toDateString()) return 'Heute';
  if (normalized.toDateString() === yesterday.toDateString()) return 'Gestern';
  return normalized.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function isOlderThanThirtyDays(dateStr: string): boolean {
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  const target = parseIsoDate(dateStr);
  return (current.getTime() - target.getTime()) / (1000 * 60 * 60 * 24) > 30;
}