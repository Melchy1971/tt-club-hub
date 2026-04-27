import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let triggeredBy = 'cron';
    try {
      const body = await req.json();
      if (body && typeof body.triggered_by === 'string') triggeredBy = body.triggered_by;
    } catch {
      // no body / not JSON => bleibt 'cron'
    }

    const { data: result, error: rpcError } = await supabase.rpc(
      'check_seasons_permission_consistency',
    );
    if (rpcError) throw rpcError;

    const payload = result as {
      module: string;
      is_consistent: boolean;
      issue_count: number;
      issues: unknown[];
    };

    const { error: insertError } = await supabase
      .from('permission_consistency_audit')
      .insert({
        module: payload.module,
        is_consistent: payload.is_consistent,
        issue_count: payload.issue_count,
        issues: payload.issues,
        triggered_by: triggeredBy,
      });
    if (insertError) throw insertError;

    if (!payload.is_consistent) {
      console.error('[seasons-consistency-check] Abweichungen gefunden', {
        issue_count: payload.issue_count,
        issues: payload.issues,
      });
    } else {
      console.log('[seasons-consistency-check] OK – keine Abweichungen');
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[seasons-consistency-check] Fehler', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});