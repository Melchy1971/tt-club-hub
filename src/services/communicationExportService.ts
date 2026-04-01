import { supabase } from '@/integrations/supabase/client';
import { ok, err, tryCatch } from '@/lib/api';
import { fromSupabaseError } from '@/lib/error';
import type { ApiResult } from '@/types/api';
import type { CommunicationExportMeta } from '@/types/domain/communication';

export interface RatingExportRow {
  rank: number;
  memberId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  qttr: number | null;
  ttr: number | null;
}

export interface RatingExportPayload {
  meta: CommunicationExportMeta;
  rows: RatingExportRow[];
}

function toCsv(rows: RatingExportRow[]): string {
  const header = ['Rang', 'MitgliedId', 'Name', 'QTTR', 'TTR'];
  const csvRows = rows.map((row) => [
    row.rank,
    row.memberId,
    `"${row.fullName.replaceAll('"', '""')}"`,
    row.qttr ?? '',
    row.ttr ?? '',
  ].join(','));

  return [header.join(','), ...csvRows].join('\n');
}

export const communicationExportService = {
  async buildRatingExport(meta: CommunicationExportMeta): Promise<ApiResult<RatingExportPayload>> {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, qttr_rating, ttr_rating, is_active')
        .eq('is_active', true)
        .order('qttr_rating', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const rows: RatingExportRow[] = ((data ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        qttr_rating: number | null;
        ttr_rating: number | null;
      }>).map((member, index) => ({
        rank: index + 1,
        memberId: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: `${member.first_name} ${member.last_name}`.trim(),
        qttr: member.qttr_rating,
        ttr: member.ttr_rating,
      }));

      return { meta, rows };
    }, fromSupabaseError);
  },

  async buildRatingCsv(meta: CommunicationExportMeta): Promise<ApiResult<string>> {
    const payloadResult = await communicationExportService.buildRatingExport(meta);
    if (!payloadResult.success) return err(payloadResult.error);
    return ok(toCsv(payloadResult.data.rows));
  },
};
