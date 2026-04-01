/**
 * Audit-Log
 *
 * Protokolliert sicherheitskritische Aktionen in der Datenbank.
 * Ausfälle beim Schreiben sind NON-FATAL – der Haupt-Workflow wird
 * nie durch Audit-Fehler geblockt.
 *
 * DB-Tabelle (muss einmalig angelegt werden):
 *
 * ```sql
 * CREATE TABLE audit_log (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   action     text NOT NULL,
 *   entity     text NOT NULL,
 *   entity_id  text,
 *   user_id    uuid REFERENCES auth.users(id),
 *   details    jsonb,
 *   created_at timestamptz NOT NULL DEFAULT now()
 * );
 *
 * -- Nur eigene Einträge lesen; Schreiben für alle authentifizierten Nutzer
 * ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "users_insert_audit" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
 * CREATE POLICY "admin_read_audit"   ON audit_log FOR SELECT USING (
 *   EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','developer'))
 * );
 * ```
 *
 * Verwendung:
 *
 * ```ts
 * // In einem Mutation-onSuccess:
 * await logAudit('member.delete', memberId, { name: 'Max Mustermann' }, userId);
 *
 * // Mit dem Audit-Wrapper (empfohlen für kritische Aktionen):
 * const deleteMut = useMutation({
 *   mutationFn: async (id: string) => {
 *     await memberService.remove(id);
 *     await logAudit('member.delete', id, {}, user?.id);
 *   },
 * });
 * ```
 */

import { supabase } from '@/integrations/supabase/client';

// ── Typen ─────────────────────────────────────────────────────

/**
 * Alle auditierbaren Aktionen.
 * Format: '{entity}.{verb}'
 */
export type AuditAction =
  // Mitglieder
  | 'member.create'
  | 'member.update'
  | 'member.delete'
  | 'member.deactivate'
  | 'member.reactivate'

  // Rollen (höchstes Risiko)
  | 'role.assign'
  | 'role.remove'

  // Saisons
  | 'season.create'
  | 'season.update'
  | 'season.delete'
  | 'season.set_current'

  // Vorstandssitzungen
  | 'board_meeting.create'
  | 'board_meeting.publish'
  | 'board_meeting.delete'

  // Dokumente
  | 'document.upload'
  | 'document.delete'
  | 'document.publish'    // is_internal false gesetzt

  // Einstellungen
  | 'settings.update'

  // Spielplan
  | 'schedule_match.delete';

// ── Kern-Funktion ─────────────────────────────────────────────

/**
 * Schreibt einen Audit-Log-Eintrag.
 *
 * @param action    Typisierte Aktion (z. B. 'role.assign')
 * @param entityId  ID des betroffenen Datensatzes (null für nicht-entitätsbezogene Aktionen)
 * @param details   Zusätzliche Kontextinformationen (Namen, vorherige Werte, etc.)
 * @param userId    ID des ausführenden Nutzers (aus AuthContext)
 *
 * Schlägt diese Funktion fehl, wird eine Konsol-Warnung ausgegeben.
 * Das Hauptprogramm wird NICHT unterbrochen.
 */
export async function logAudit(
  action:   AuditAction,
  entityId: string | null,
  details:  Record<string, unknown> = {},
  userId?:  string | null,
): Promise<void> {
  try {
    const entity = action.split('.')[0];
    const { error } = await supabase.from('audit_log').insert({
      action,
      entity,
      entity_id: entityId,
      user_id:   userId ?? null,
      details,
    });

    if (error) {
      // Tabelle existiert möglicherweise noch nicht (Migration ausstehend)
      console.warn('[audit] Schreiben fehlgeschlagen:', error.message, { action, entityId });
    }
  } catch (e) {
    // Netzwerkfehler o. ä. – silent fail, kein throw
    console.warn('[audit] Unerwarteter Fehler:', e);
  }
}

// ── Vorgefertigte Hilfsfunktionen ─────────────────────────────

/** Rolle wurde einem Nutzer zugewiesen. */
export const auditRoleAssign = (
  targetUserId: string,
  role:         string,
  actorId?:     string | null,
) => logAudit('role.assign', targetUserId, { role }, actorId);

/** Rolle wurde von einem Nutzer entfernt. */
export const auditRoleRemove = (
  targetUserId: string,
  role:         string,
  actorId?:     string | null,
) => logAudit('role.remove', targetUserId, { role }, actorId);

/** Mitglied wurde gelöscht. */
export const auditMemberDelete = (
  memberId: string,
  name:     string,
  actorId?: string | null,
) => logAudit('member.delete', memberId, { name }, actorId);

/** Sitzungsprotokoll wurde veröffentlicht. */
export const auditMeetingPublish = (
  meetingId: string,
  title:     string,
  actorId?:  string | null,
) => logAudit('board_meeting.publish', meetingId, { title }, actorId);

/** Internes Dokument wurde öffentlich gemacht. */
export const auditDocumentPublish = (
  documentId: string,
  title:      string,
  actorId?:   string | null,
) => logAudit('document.publish', documentId, { title }, actorId);

/** Saison wurde als aktiv gesetzt. */
export const auditSeasonSetCurrent = (
  seasonId: string,
  name:     string,
  actorId?: string | null,
) => logAudit('season.set_current', seasonId, { name }, actorId);
