/**
 * privacyService
 *
 * Typsichere Datenschutz-Operationen ohne `as any`.
 * Alle drei Tabellen (member_consents, consent_audit_log, deletion_requests)
 * sind in den generierten Supabase-Typen vorhanden.
 *
 * Bekannte Einschränkung: toggleConsent() führt zwei separate DB-Calls durch
 * (upsert consent + insert audit). Für atomare Ausführung muss eine
 * Postgres-RPC-Funktion `rpc_toggle_consent` angelegt werden:
 *   create or replace function rpc_toggle_consent(
 *     p_member_id uuid, p_consent_type text, p_granted boolean, p_performed_by uuid
 *   ) returns void ...
 */

import { supabase } from '@/integrations/supabase/client';
import type { ConsentRow, ConsentAuditRow, DeletionRequestRow, ConsentType, DeletionStatus } from '@/types/privacy';

// ── Consents ──────────────────────────────────────────────────

/** Alle Einwilligungen eines Mitglieds. */
export async function getConsents(memberId: string): Promise<ConsentRow[]> {
  const { data, error } = await supabase
    .from('member_consents')
    .select('*')
    .eq('member_id', memberId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Einwilligung setzen oder aktualisieren + Audit-Eintrag schreiben.
 *
 * Nicht atomar – bei Audit-Fehler bleibt der Consent-Eintrag bestehen.
 * Für produktionskritische Atomarität: DB-RPC verwenden.
 */
export async function toggleConsent(
  memberId: string,
  userId: string,
  consentType: ConsentType,
  granted: boolean,
): Promise<void> {
  const now = new Date().toISOString();

  // Upsert: conflict on (member_id, consent_type)
  const { error: consentError } = await supabase
    .from('member_consents')
    .upsert(
      {
        member_id: memberId,
        consent_type: consentType,
        granted,
        granted_at: granted ? now : null,
        revoked_at: granted ? null : now,
      },
      { onConflict: 'member_id,consent_type' },
    );
  if (consentError) throw consentError;

  // Audit – non-fatal: failure logged to console, does not roll back consent
  const { error: auditError } = await supabase
    .from('consent_audit_log')
    .insert({
      member_id: memberId,
      consent_type: consentType,
      action: granted ? 'granted' : 'revoked',
      performed_by: userId,
    });
  if (auditError) {
    console.error('[privacyService] consent_audit_log insert failed:', auditError);
  }
}

// ── Audit-Log ─────────────────────────────────────────────────

/** Letzte 20 Einträge des Consent-Audit-Logs für ein Mitglied. */
export async function getAuditLog(memberId: string): Promise<ConsentAuditRow[]> {
  const { data, error } = await supabase
    .from('consent_audit_log')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

// ── Löschanfragen ─────────────────────────────────────────────

/** Alle Löschanfragen eines Mitglieds (neueste zuerst). */
export async function getDeletionRequests(memberId: string): Promise<DeletionRequestRow[]> {
  const { data, error } = await supabase
    .from('deletion_requests')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Neue Löschanfrage erstellen. */
export async function createDeletionRequest(
  memberId: string,
  requestedBy: string,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('deletion_requests')
    .insert({
      member_id: memberId,
      requested_by: requestedBy,
      reason: reason ?? null,
      status: 'pending' satisfies DeletionStatus,
    });
  if (error) throw error;
}

/**
 * Löschanfrage-Status aktualisieren (Admin-Aktion).
 * Prüft erlaubte Übergänge nicht auf DB-Ebene – Aufrufer muss
 * `canTransitionDeletion()` aus types/privacy vorab prüfen.
 */
export async function updateDeletionStatus(
  requestId: string,
  status: DeletionStatus,
  reviewedBy: string,
): Promise<void> {
  const { error } = await supabase
    .from('deletion_requests')
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}

// ── Sichtbarkeits-Guard ───────────────────────────────────────

/**
 * Prüft, ob ein bestimmtes Datenfeld für den anfragenden Nutzer sichtbar ist.
 * Wird von anderen Services aufgerufen, bevor personenbezogene Felder
 * in API-Antworten eingeschlossen werden.
 *
 * Sichtbarkeitsregeln:
 *   profile_visible = false → Profil generell ausgeblendet (außer für Admins)
 *   email_hidden    = true  → E-Mail nur für Admins sichtbar
 *   phone_hidden    = true  → Telefon nur für Admins/Trainer sichtbar
 */
export function isFieldVisible(
  consents: ConsentRow[],
  field: 'profile' | 'email' | 'phone',
  viewerIsAdmin: boolean,
): boolean {
  if (viewerIsAdmin) return true;

  const map: Record<typeof field, string> = {
    profile: 'profile_visible',
    email:   'email_hidden',
    phone:   'phone_hidden',
  };

  const consent = consents.find((c) => c.consent_type === map[field]);

  if (field === 'profile') {
    // profile_visible: true → sichtbar, false/unset → nicht sichtbar
    return consent?.granted ?? false;
  }

  // email_hidden / phone_hidden: true → verborgen, false/unset → sichtbar
  return !(consent?.granted ?? false);
}
