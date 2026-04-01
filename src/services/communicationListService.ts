/**
 * communicationListService
 *
 * Verwaltet Kommunikationslisten (Verteiler) und deren Mitgliedschaft.
 *
 * Tabellen:
 *   communication_lists         – Listenmetadaten (name, list_type)
 *   communication_list_members  – n:m Zuordnung Liste ↔ Mitglied
 *
 * Listentypen (list_type – frei wählbar):
 *   email    → E-Mail-Verteiler
 *   sms      → SMS-Benachrichtigung
 *   whatsapp → WhatsApp-Gruppe
 *   internal → vereinsinterne Verteilerliste
 */

import { supabase } from '@/integrations/supabase/client';
import { ok, err } from '@/lib/api';
import { fromSupabaseError, errors } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type { CommunicationAudience } from '@/types/domain/communication';

// ── Typen ─────────────────────────────────────────────────────

export interface CommunicationListRow {
  id:          string;
  name:        string;
  description: string | null;
  list_type:   string;
  created_by:  string;
  created_at:  string;
  updated_at:  string;
}

export interface CommunicationListUI {
  id:          string;
  name:        string;
  description: string | null;
  listType:    string;
  audience:    Exclude<CommunicationAudience, 'all'>;
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
  memberCount?: number;
}

export interface ListMember {
  listId:    string;
  memberId:  string;
  firstName: string;
  lastName:  string;
  email:     string | null;
  addedAt:   string;
}

export interface CommunicationListCreateDTO {
  name:         string;
  description?: string;
  list_type?:   string;
  created_by:   string;
}

export interface CommunicationListUpdateDTO {
  name?:        string;
  description?: string;
  list_type?:   string;
}

export interface CommunicationListFilter {
  audience?: CommunicationAudience;
}

// ── Mapping ───────────────────────────────────────────────────

function mapToUI(row: CommunicationListRow, memberCount?: number): CommunicationListUI {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    listType:    row.list_type,
    audience:    row.list_type === 'internal' ? 'internal' : 'public',
    createdBy:   row.created_by,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    memberCount,
  };
}

// ── Service ───────────────────────────────────────────────────

export const communicationListService = {
  async list(filter: CommunicationListFilter = {}): Promise<ApiResult<CommunicationListUI[]>> {
    let q = supabase
      .from('communication_lists')
      .select('*')
      .order('name', { ascending: true });

    if (filter.audience === 'internal') q = q.eq('list_type', 'internal');
    if (filter.audience === 'public') q = q.neq('list_type', 'internal');

    const { data, error } = await q;
    if (error) return err(fromSupabaseError(error));
    return ok(((data ?? []) as CommunicationListRow[]).map((r) => mapToUI(r)));
  },

  async getById(id: string): Promise<ApiResult<CommunicationListUI>> {
    const { data, error } = await supabase
      .from('communication_lists')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return err(fromSupabaseError(error));
    if (!data)  return err(errors.notFound('Kommunikationsliste', id));
    return ok(mapToUI(data as CommunicationListRow));
  },

  async create(payload: CommunicationListCreateDTO): Promise<ApiResult<CommunicationListUI>> {
    const { data, error } = await supabase
      .from('communication_lists')
      .insert({ ...payload, list_type: payload.list_type ?? 'email' })
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(mapToUI(data as CommunicationListRow));
  },

  async update(id: string, payload: CommunicationListUpdateDTO): Promise<ApiResult<CommunicationListUI>> {
    const { data, error } = await supabase
      .from('communication_lists')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return err(fromSupabaseError(error));
    return ok(mapToUI(data as CommunicationListRow));
  },

  async remove(id: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('communication_lists')
      .delete()
      .eq('id', id);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  // ── Mitgliederverwaltung ───────────────────────────────────

  /** Gibt alle Mitglieder einer Liste zurück (mit name + email via JOIN). */
  async getMembers(listId: string): Promise<ApiResult<ListMember[]>> {
    const { data, error } = await supabase
      .from('communication_list_members')
      .select(`
        list_id,
        member_id,
        created_at,
        members (
          first_name,
          last_name,
          email
        )
      `)
      .eq('list_id', listId)
      .order('created_at', { ascending: true });
    if (error) return err(fromSupabaseError(error));

    const members: ListMember[] = ((data ?? []) as Array<{
      list_id:    string;
      member_id:  string;
      created_at: string;
      members: { first_name: string; last_name: string; email: string | null } | null;
    }>).map((row) => ({
      listId:    row.list_id,
      memberId:  row.member_id,
      firstName: row.members?.first_name ?? '',
      lastName:  row.members?.last_name ?? '',
      email:     row.members?.email ?? null,
      addedAt:   row.created_at,
    }));

    return ok(members);
  },

  async addMember(listId: string, memberId: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('communication_list_members')
      .insert({ list_id: listId, member_id: memberId });
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  async removeMember(listId: string, memberId: string): Promise<ApiResult<void>> {
    const { error } = await supabase
      .from('communication_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('member_id', memberId);
    if (error) return err(fromSupabaseError(error));
    return ok(undefined);
  },

  /**
   * Ersetzt die vollständige Mitgliederliste atomisch.
   * Zuerst alle löschen, dann die neuen einfügen.
   * Hinweis: kein DB-Rollback – bei Insert-Fehler bleibt die Liste leer.
   * Für produktive Anforderungen empfohlen: DB-Funktion / RPC verwenden.
   */
  async setMembers(listId: string, memberIds: string[]): Promise<ApiResult<void>> {
    const { error: delError } = await supabase
      .from('communication_list_members')
      .delete()
      .eq('list_id', listId);
    if (delError) return err(fromSupabaseError(delError));

    if (memberIds.length === 0) return ok(undefined);

    const { error: insError } = await supabase
      .from('communication_list_members')
      .insert(memberIds.map((member_id) => ({ list_id: listId, member_id })));
    if (insError) return err(fromSupabaseError(insError));
    return ok(undefined);
  },

  /**
   * Gibt eine Liste mit Mitgliederzahl zurück (für Übersichts-Tabelle).
   * Zwei separate Queries statt eines unzuverlässigen COUNT-Joins.
   */
  async listWithCounts(): Promise<ApiResult<CommunicationListUI[]>> {
    const [listsResult, countsResult] = await Promise.all([
      supabase.from('communication_lists').select('*').order('name'),
      supabase.from('communication_list_members').select('list_id'),
    ]);

    if (listsResult.error) return err(fromSupabaseError(listsResult.error));
    if (countsResult.error) return err(fromSupabaseError(countsResult.error));

    const countMap = new Map<string, number>();
    for (const row of (countsResult.data ?? []) as { list_id: string }[]) {
      countMap.set(row.list_id, (countMap.get(row.list_id) ?? 0) + 1);
    }

    const lists = ((listsResult.data ?? []) as CommunicationListRow[]).map((r) =>
      mapToUI(r, countMap.get(r.id) ?? 0),
    );
    return ok(lists);
  },
};
