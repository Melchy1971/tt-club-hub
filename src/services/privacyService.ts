/**
 * privacyService
 *
 * Typsichere Datenschutz-Operationen über DB-RPC:
 * - atomare Consent-Änderung inkl. Audit
 * - Deletion-Workflow mit serverseitiger Zustandsmaschine
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
 *
 * Atomar via `rpc_set_member_consent` (Upsert + Audit in einer DB-Funktion).
 */
export async function toggleConsent(
  memberId: string,
  consentType: ConsentType,
  granted: boolean,
  source: 'self' | 'admin' | 'import' | 'system' = 'self',
  context?: AuditContext,
): Promise<void> {
  const { error } = await supabase.rpc('rpc_set_member_consent', {
    p_member_id: memberId,
    p_consent_type: consentType,
    p_granted: granted,
    p_source: source,
    p_actor_ip: context?.ip ?? null,
    p_actor_user_agent: context?.userAgent ?? null,
  });
  if (error) throw error;
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
  context?: AuditContext,
): Promise<string> {
  const { data, error } = await supabase.rpc('rpc_create_deletion_request', {
    p_member_id: memberId,
    p_reason: reason ?? null,
    p_actor_ip: context?.ip ?? null,
    p_actor_user_agent: context?.userAgent ?? null,
  });
  if (error) throw error;
  return data;
}

/**
 * Löschanfrage-Status aktualisieren (Admin-Aktion).
 * Erlaubte Übergänge werden zusätzlich auf DB-Ebene per Trigger validiert.
 */
export async function updateDeletionStatus(
  requestId: string,
  status: DeletionStatus,
  decisionNote?: string,
  context?: AuditContext,
): Promise<void> {
  const { error } = await supabase.rpc('rpc_transition_deletion_request', {
    p_request_id: requestId,
    p_next_status: status,
    p_decision_note: decisionNote ?? null,
    p_actor_ip: context?.ip ?? null,
    p_actor_user_agent: context?.userAgent ?? null,
  });
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

/**
 * Datenschutzsicht für Self-Service:
 * liefert ausschließlich das eigene Mitgliedsprofil inkl. persönlicher Felder.
 */
export async function getSelfPrivacyView() {
  const { data, error } = await supabase.from('member_privacy_self_view').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Datenschutzsicht für Admin/Vorstand:
 * liefert minimierte personenbezogene Daten und respektiert Consent-Flags.
 */
export async function getAdminPrivacyView() {
  const { data, error } = await supabase.from('member_privacy_admin_view').select('*');
  if (error) throw error;
  return data ?? [];
}
