/**
 * privacyService
 *
 * Typsichere Datenschutz-Operationen:
 * - Consent-Verwaltung über bestehende Tabellen
 * - Deletion-Workflow
 * - Self-Service/Admin-Datenschutzsichten
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AuditContext,
  ConsentAuditRow,
  ConsentRow,
  ConsentType,
  DeletionRequestRow,
  DeletionStatus,
} from '@/types/privacy';

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
 * Uses direct upsert + audit insert since the RPC does not exist yet.
 */
export async function toggleConsent(
  memberId: string,
  consentType: ConsentType,
  granted: boolean,
  source: 'self' | 'admin' | 'import' | 'system' = 'self',
  context?: AuditContext,
): Promise<void> {
  // Upsert consent
  const { error: upsertError } = await supabase
    .from('member_consents')
    .upsert(
      {
        member_id: memberId,
        consent_type: consentType,
        granted,
        granted_at: granted ? new Date().toISOString() : null,
        revoked_at: granted ? null : new Date().toISOString(),
      },
      { onConflict: 'member_id,consent_type' as any },
    );
  if (upsertError) throw upsertError;

  // Write audit log
  const { error: auditError } = await supabase
    .from('consent_audit_log')
    .insert({
      member_id: memberId,
      consent_type: consentType,
      action: granted ? 'granted' : 'revoked',
      performed_by: source,
    });
  if (auditError) throw auditError;
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
  reason?: string,
  _context?: AuditContext,
): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  const requestedBy = user?.user?.id ?? 'system';

  const { data, error } = await supabase
    .from('deletion_requests')
    .insert({
      member_id: memberId,
      reason: reason ?? null,
      requested_by: requestedBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Löschanfrage-Status aktualisieren (Admin-Aktion).
 */
export async function updateDeletionStatus(
  requestId: string,
  status: DeletionStatus,
  _decisionNote?: string,
  _context?: AuditContext,
): Promise<void> {
  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('deletion_requests')
    .update({
      status,
      reviewed_by: user?.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (error) throw error;
}

// ── Sichtbarkeits-Guard ───────────────────────────────────────

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
    return consent?.granted ?? false;
  }

  return !(consent?.granted ?? false);
}

/**
 * Datenschutzsicht für Self-Service:
 * liefert Consent-Daten des aktuellen Nutzers.
 */
export async function getSelfPrivacyView() {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;

  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .eq('user_id', user.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Datenschutzsicht für Admin/Vorstand:
 * liefert minimierte personenbezogene Daten.
 */
export async function getAdminPrivacyView() {
  const { data, error } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, is_active')
    .order('last_name');
  if (error) throw error;
  return data ?? [];
}
