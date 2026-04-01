/**
 * Privacy & Consent Typen
 *
 * Typisierung für member_consents, consent_audit_log und deletion_requests.
 * Basiert auf den generierten Supabase-Typen – kein `as any` nötig.
 */

import type { Tables } from '@/integrations/supabase/types';

// ── Consent-Typen ─────────────────────────────────────────────

/**
 * Bekannte Einwilligungstypen. Muss mit den in der DB gespeicherten Werten
 * übereinstimmen (Freitext-Spalte consent_type).
 */
export const CONSENT_TYPES = ['profile_visible', 'email_hidden', 'phone_hidden'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export function isConsentType(value: string): value is ConsentType {
  return (CONSENT_TYPES as readonly string[]).includes(value);
}

/** Labels und Beschreibungen für die UI – Single Source of Truth */
export const CONSENT_TYPE_META: Record<ConsentType, { label: string; description: string }> = {
  profile_visible: {
    label: 'Profil für Teammitglieder sichtbar',
    description: 'Kontaktdaten für andere Mitglieder anzeigen',
  },
  email_hidden: {
    label: 'E-Mail-Adresse verbergen',
    description: 'E-Mail nur für Administratoren sichtbar',
  },
  phone_hidden: {
    label: 'Telefonnummer verbergen',
    description: 'Telefonnummer nur für Trainer und Administratoren sichtbar',
  },
};

// ── Consent-Zeilen (DB-Typen) ─────────────────────────────────

export type ConsentRow = Tables<'member_consents'>;
export type ConsentAuditRow = Tables<'consent_audit_log'>;

/**
 * Quelle einer Consent-Änderung – ergänzt die DB-Spalte `performed_by` (user_id)
 * um semantischen Kontext. Wird als Freitext in `action` kodiert, bis eine
 * eigene DB-Spalte hinzugefügt wird.
 *
 * Format: `${action}:${source}` → z. B. "granted:self", "revoked:admin"
 */
export type ConsentAuditSource = 'self' | 'admin' | 'import' | 'system';

// ── Löschanfragen ─────────────────────────────────────────────

export type DeletionRequestRow = Tables<'deletion_requests'>;

/**
 * Erlaubte Status-Werte für deletion_requests.status.
 * Die DB-Spalte ist plain string – diese Union dient als Laufzeit-Guard.
 *
 * Zustandsmaschine:
 *   pending → approved → executing → completed
 *   pending → rejected
 *   pending → cancelled   (durch den Antragsteller selbst)
 */
export type DeletionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'executing'
  | 'completed';

export function isDeletionStatus(value: string): value is DeletionStatus {
  return ['pending', 'approved', 'rejected', 'cancelled', 'executing', 'completed'].includes(value);
}

/**
 * Erlaubte Folgestatus je Ausgangsstatus.
 * Nur die hier aufgeführten Übergänge sind zulässig.
 */
export const DELETION_STATUS_TRANSITIONS: Record<DeletionStatus, DeletionStatus[]> = {
  pending:   ['approved', 'rejected', 'cancelled'],
  approved:  ['executing', 'cancelled'],
  executing: ['completed'],
  completed: [],
  rejected:  [],
  cancelled: [],
};

export function canTransitionDeletion(from: DeletionStatus, to: DeletionStatus): boolean {
  return DELETION_STATUS_TRANSITIONS[from].includes(to);
}

// ── Hilfsfunktionen ───────────────────────────────────────────

/** Liest den granted-Wert eines bestimmten ConsentType aus einer Liste. */
export function getConsentValue(consents: ConsentRow[], type: ConsentType): boolean {
  return consents.find((c) => c.consent_type === type)?.granted ?? false;
}

/** UI-Labels für DeletionStatus */
export const DELETION_STATUS_LABEL: Record<DeletionStatus, string> = {
  pending:   'Ausstehend',
  approved:  'Genehmigt',
  rejected:  'Abgelehnt',
  cancelled: 'Storniert',
  executing: 'Wird ausgeführt',
  completed: 'Abgeschlossen',
};
