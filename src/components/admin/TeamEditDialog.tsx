/**
 * TeamEditDialog – Mannschaft anlegen oder bearbeiten.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AGE_GROUP_LABELS_DE } from '@/constants/uiLabels';

interface TeamFormData {
  name: string;
  league: string;
  age_group: string;
  season_phase_id: string;
  team_size: 4 | 6 | null;
  is_active: boolean;
  clicktt_url: string;
}

interface TeamEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any | null; // null = create mode
  onSave: (data: TeamFormData, id?: string) => void;
  saving?: boolean;
}

export function TeamEditDialog({ open, onOpenChange, team, onSave, saving }: TeamEditDialogProps) {
  const [form, setForm] = useState<TeamFormData>({
    name: '',
    league: '',
    age_group: 'herren',
    season_phase_id: '',
    team_size: null,
    is_active: true,
    clicktt_url: '',
  });

  const { data: phases } = useQuery({
    queryKey: ['season-phases-for-team-dialog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('season_phases')
        .select('id, name, is_active, season_cycle_id, season_cycles(id, name, is_active)')
        .order('start_date', { ascending: false });
      if (error) throw error;
      // Only show phases from active cycles
      return (data ?? []).filter((p: any) => p.season_cycles?.is_active);
    },
    enabled: open,
  });

  useEffect(() => {
    if (team) {
      setForm({
        name: team.name ?? '',
        league: team.league ?? '',
        age_group: team.age_group ?? 'herren',
        season_phase_id: team.season_phase_id ?? '',
        team_size: (team.team_size === 4 || team.team_size === 6) ? team.team_size : null,
        is_active: team.is_active ?? true,
        clicktt_url: team.clicktt_url ?? '',
      });
    } else {
      const activePhase = phases?.find((p) => p.is_active);
      setForm({
        name: '',
        league: '',
        age_group: 'herren',
        season_phase_id: activePhase?.id ?? phases?.[0]?.id ?? '',
        team_size: null,
        is_active: true,
        clicktt_url: '',
      });
    }
  }, [team, open, phases]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form, team?.id);
  };

  const isValid = form.name.trim() && form.league.trim() && form.season_phase_id && form.team_size != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{team ? 'Mannschaft bearbeiten' : 'Neue Mannschaft'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name *</Label>
            <Input
              id="team-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="z.B. Herren I"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-league">Liga *</Label>
            <Input
              id="team-league"
              value={form.league}
              onChange={(e) => setForm((f) => ({ ...f, league: e.target.value }))}
              placeholder="z.B. Bezirksliga"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Altersklasse</Label>
              <Select value={form.age_group} onValueChange={(v) => setForm((f) => ({ ...f, age_group: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AGE_GROUP_LABELS_DE).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Typ *</Label>
              <Select
                value={form.team_size != null ? String(form.team_size) : ''}
                onValueChange={(v) => setForm((f) => ({ ...f, team_size: Number(v) as 4 | 6 }))}
              >
                <SelectTrigger><SelectValue placeholder="4er / 6er" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4er</SelectItem>
                  <SelectItem value="6">6er</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Saisonphase</Label>
            <Select value={form.season_phase_id} onValueChange={(v) => setForm((f) => ({ ...f, season_phase_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Saisonphase wählen" /></SelectTrigger>
              <SelectContent>
                {(phases ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.season_cycles?.name} – {p.name} {p.is_active ? '(aktiv)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
            <Label>Aktiv</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-clicktt-url">Click-TT Tabellen-Link</Label>
            <Input
              id="team-clicktt-url"
              type="url"
              value={form.clicktt_url}
              onChange={(e) => setForm((f) => ({ ...f, clicktt_url: e.target.value }))}
              placeholder="https://www.mytischtennis.de/click-tt/..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? 'Speichern…' : team ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
