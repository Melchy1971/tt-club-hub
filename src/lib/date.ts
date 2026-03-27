import { format, formatDistance, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

// === Formatierung ===

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM.yyyy', { locale: de });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM.yyyy HH:mm', { locale: de });
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd. MMM yyyy', { locale: de });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: de });
}

/** Relativangabe, z.B. "vor 3 Tagen", "in 2 Stunden" */
export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(d, new Date(), { locale: de, addSuffix: true });
}

// === ISO-Datum-Helfer ===

/** Gibt das heutige Datum als ISO-String (YYYY-MM-DD) zurück */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Konvertiert ein Date-Objekt in einen ISO-Datums-String (YYYY-MM-DD) */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// === Vergleiche ===

export function isDateInPast(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date()) && !isToday(d);
}

export function isDateInFuture(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(d, new Date());
}

export { isToday, parseISO };
