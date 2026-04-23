import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgeGroupLabel } from '@/constants/uiLabels';

export default function Standings() {
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, age_group, league, division, clicktt_url')
        .eq('is_active', true)
        .order('age_group')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Tabelle</h1>
        <p className="page-description">
          Tabellen der Mannschaften auf Click-TT.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-md" />
          ))}
        </div>
      ) : (teams ?? []).length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Keine Mannschaften vorhanden.</p>
      ) : (
        (teams ?? []).map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                {team.name}
                {team.league && (
                  <Badge variant="outline" className="ml-2 font-normal">
                    {team.league}
                  </Badge>
                )}
                <Badge variant="secondary" className="font-normal">
                  {getAgeGroupLabel(team.age_group)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {team.clicktt_url ? (
                <a href={team.clicktt_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-4 w-4" />
                    Tabelle auf Click-TT ansehen
                  </Button>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Click-TT Link hinterlegt.</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}