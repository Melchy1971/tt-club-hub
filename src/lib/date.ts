import { format, formatDistance, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

/**
 * Prüft ein Datum im Format YYYY-MM-DD inkl. Kalendertag-Validität.
 * Beispiel: 2026-02-31 => false
 */
export function isISODateString(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;

  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/**
 * Normalisiert ein unbekanntes Eingabedatum auf ISO YYYY-MM-DD.
 * - undefined bleibt undefined
 * - null/'' werden null
 * - Date wird zu YYYY-MM-DD
 * - String wird getrimmt und nur im ISO-Format akzeptiert
 */
export function normalizeISODateValue(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toISODate(value);
  }

  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return isISODateString(normalized) ? normalized : null;
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
