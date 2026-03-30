import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScheduleMatch, Team, Member } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: ScheduleMatch[];
  teams: Team[];
  members: Member[];
  unavailabilities: { match_id: string; member_id: string }[];
  onSave: (data: { match_id: string; team_id: string; requesting_member_id: string; note?: string }) => void;
}

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function CreateRequestDialog({ open, onOpenChange, matches, teams, members, unavailabilities, onSave }: Props) {
  const [matchId, setMatchId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [note, setNote] = useState('');

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const selectedMatch = matches.find((m) => m.id === matchId);

  // Show unavailable members for the selected match
  const unavailableForMatch = unavailabilities
    .filter((u) => u.match_id === matchId)
    .map((u) => u.member_id);

  const unavailableMembers = members.filter((m) => unavailableForMatch.includes(m.id));

  const handleSave = () => {
    if (!matchId || !memberId) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    onSave({
      match_id: matchId,
      team_id: match.team_id,
      requesting_member_id: memberId,
      note: note || undefined,
    });
    setMatchId('');
    setMemberId('');
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ersatzanfrage erstellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Spiel</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Spiel wählen" />
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => {
                  const team = teamMap.get(m.team_id);
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      {m.home_team} – {m.away_team} · {formatGermanDate(m.match_date)}
                      {team ? ` (${team.name})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fehlender Spieler</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Spieler wählen" />
              </SelectTrigger>
              <SelectContent>
                {matchId && unavailableMembers.length > 0 ? (
                  unavailableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))
                ) : (
                  // Allow selecting any member if none marked unavailable
                  members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Grund der Abwesenheit"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!matchId || !memberId}>
            Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
