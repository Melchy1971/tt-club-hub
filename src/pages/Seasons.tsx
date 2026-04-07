import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Star, StarOff, Users, Trophy,
} from 'lucide-react';
import {
  seasonCycleService, seasonPhaseService,
  type SeasonCycleWithPhases,
} from '@/services/seasonCycleService';
import { useSeason } from '@/contexts/SeasonContext';
import { useAuth } from '@/contexts/AuthContext';
import { canWriteSeasons, canDeleteSeasons } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { Constants } from '@/integrations/supabase/types';
import { getAgeGroupLabel, getPhaseTypeLabel } from '@/constants/uiLabels';
import type { SeasonCycleInsert, SeasonPhaseInsert, SeasonPhase } from '@/types';

const ADULT_GROUPS = ['herren', 'damen', 'senioren', 'seniorinnen'];

function isAdult(ageGroup: string): boolean {
  return ADULT_GROUPS.includes(ageGroup);
}

// ─── Cycle Form ──────────────────────────────────────────────────────────────

const initialCycleForm = {
  name: '', start_year: new Date().getFullYear(), end_year: new Date().getFullYear() + 1,
  age_group: 'herren' as string, is_active: false,
};

// ─── Phase Form ──────────────────────────────────────────────────────────────

const initialPhaseForm = {
  name: '', start_date: '', end_date: '',
  phase_type: 'first_half' as string, is_active: false, sort_order: 1,
};

export default function Seasons() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { refresh: refreshSeason } = useSeason();
  const canWrite = canWriteSeasons(role);
  const canDelete = canDeleteSeasons(role);

  // Cycle state
  const [cycleFormOpen, setCycleFormOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<SeasonCycleWithPhases | null>(null);
  const [cycleForm, setCycleForm] = useState(initialCycleForm);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());

  // Phase state
  const [phaseFormOpen, setPhaseFormOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<SeasonPhase | null>(null);
  const [phaseForm, setPhaseForm] = useState(initialPhaseForm);
  const [phaseParentCycleId, setPhaseParentCycleId] = useState<string | null>(null);
  const [phaseParentAgeGroup, setPhaseParentAgeGroup] = useState<string>('herren');
  const [deletePhaseId, setDeletePhaseId] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['season-cycles'],
    queryFn: seasonCycleService.getAll,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['season-cycles'] });
    queryClient.invalidateQueries({ queryKey: ['seasons'] });
    refreshSeason();
  };

  // ─── Cycle mutations ────────────────────────────────────────────────────────

  const createCycleMut = useMutation({
    mutationFn: (s: SeasonCycleInsert) => seasonCycleService.create(s),
    onSuccess: () => { toast.success('Saisonzyklus erstellt'); invalidate(); closeCycleForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCycleMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SeasonCycleInsert> }) =>
      seasonCycleService.update(id, data),
    onSuccess: () => { toast.success('Saisonzyklus aktualisiert'); invalidate(); closeCycleForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCycleMut = useMutation({
    mutationFn: (id: string) => seasonCycleService.remove(id),
    onSuccess: () => { toast.success('Saisonzyklus gelöscht'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCycleMut = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      seasonCycleService.toggleActive(id, val),
    onSuccess: () => { toast.success('Status aktualisiert'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Phase mutations ────────────────────────────────────────────────────────

  const createPhaseMut = useMutation({
    mutationFn: (p: SeasonPhaseInsert) => seasonPhaseService.create(p),
    onSuccess: () => { toast.success('Phase erstellt'); invalidate(); closePhaseForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePhaseMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SeasonPhaseInsert> }) =>
      seasonPhaseService.update(id, data),
    onSuccess: () => { toast.success('Phase aktualisiert'); invalidate(); closePhaseForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhaseMut = useMutation({
    mutationFn: (id: string) => seasonPhaseService.remove(id),
    onSuccess: () => { toast.success('Phase gelöscht'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePhaseMut = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      seasonPhaseService.toggleActive(id, val),
    onSuccess: () => { toast.success('Phase-Status aktualisiert'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Cycle form helpers ─────────────────────────────────────────────────────

  function closeCycleForm() {
    setCycleFormOpen(false);
    setEditingCycle(null);
    setCycleForm(initialCycleForm);
    setErrors({});
  }

  function openCreateCycle() {
    setEditingCycle(null);
    setCycleForm(initialCycleForm);
    setErrors({});
    setCycleFormOpen(true);
  }

  function openEditCycle(c: SeasonCycleWithPhases) {
    setEditingCycle(c);
    setCycleForm({
      name: c.name, start_year: c.start_year, end_year: c.end_year,
      age_group: c.age_group, is_active: c.is_active,
    });
    setErrors({});
    setCycleFormOpen(true);
  }

  function validateCycle(): boolean {
    const e: Record<string, string> = {};
    if (!cycleForm.name.trim()) e.name = 'Name ist erforderlich';
    if (cycleForm.start_year >= cycleForm.end_year) e.end_year = 'Endjahr muss nach dem Startjahr liegen';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleCycleSubmit() {
    if (!validateCycle()) return;
    const payload: SeasonCycleInsert = {
      name: cycleForm.name.trim(),
      start_year: cycleForm.start_year,
      end_year: cycleForm.end_year,
      age_group: cycleForm.age_group as any,
      is_active: cycleForm.is_active,
    };
    if (editingCycle) {
      updateCycleMut.mutate({ id: editingCycle.id, data: payload });
    } else {
      createCycleMut.mutate(payload);
    }
  }

  // ─── Phase form helpers ─────────────────────────────────────────────────────

  function closePhaseForm() {
    setPhaseFormOpen(false);
    setEditingPhase(null);
    setPhaseForm(initialPhaseForm);
    setPhaseParentCycleId(null);
    setErrors({});
  }

  function openCreatePhase(cycleId: string, ageGroup: string) {
    setEditingPhase(null);
    setPhaseParentCycleId(cycleId);
    setPhaseParentAgeGroup(ageGroup);
    const defaultType = isAdult(ageGroup) ? 'first_half' : 'single_half';
    setPhaseForm({ ...initialPhaseForm, phase_type: defaultType });
    setErrors({});
    setPhaseFormOpen(true);
  }

  function openEditPhase(phase: SeasonPhase, ageGroup: string) {
    setEditingPhase(phase);
    setPhaseParentCycleId(phase.season_cycle_id);
    setPhaseParentAgeGroup(ageGroup);
    setPhaseForm({
      name: phase.name, start_date: phase.start_date, end_date: phase.end_date,
      phase_type: phase.phase_type, is_active: phase.is_active, sort_order: phase.sort_order,
    });
    setErrors({});
    setPhaseFormOpen(true);
  }

  function validatePhase(): boolean {
    const e: Record<string, string> = {};
    if (!phaseForm.name.trim()) e.name = 'Name ist erforderlich';
    if (!phaseForm.start_date) e.start_date = 'Startdatum ist erforderlich';
    if (!phaseForm.end_date) e.end_date = 'Enddatum ist erforderlich';
    if (phaseForm.start_date && phaseForm.end_date && phaseForm.start_date >= phaseForm.end_date) {
      e.end_date = 'Enddatum muss nach dem Startdatum liegen';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handlePhaseSubmit() {
    if (!validatePhase() || !phaseParentCycleId) return;
    const payload: SeasonPhaseInsert = {
      season_cycle_id: phaseParentCycleId,
      phase_type: phaseForm.phase_type as any,
      name: phaseForm.name.trim(),
      start_date: phaseForm.start_date,
      end_date: phaseForm.end_date,
      is_active: phaseForm.is_active,
      sort_order: phaseForm.sort_order,
    };
    if (editingPhase) {
      updatePhaseMut.mutate({ id: editingPhase.id, data: payload });
    } else {
      createPhaseMut.mutate(payload);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ─── Group cycles by category ───────────────────────────────────────────────

  const adultCycles = cycles.filter((c) => isAdult(c.age_group));
  const youthCycles = cycles.filter((c) => !isAdult(c.age_group));

  function renderCycleCard(cycle: SeasonCycleWithPhases) {
    const expanded = expandedCycles.has(cycle.id);
    const phases = (cycle.season_phases ?? []).sort((a, b) => a.sort_order - b.sort_order);
    const adult = isAdult(cycle.age_group);
    const maxPhases = adult ? 2 : 1;
    const canAddPhase = canWrite && phases.length < maxPhases;

    return (
      <Card key={cycle.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <button
              className="flex items-center gap-2 text-left flex-1 min-w-0"
              onClick={() => toggleExpanded(cycle.id)}
            >
              {expanded
                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              }
              <CardTitle className="text-base truncate">{cycle.name}</CardTitle>
              <Badge variant="outline" className="shrink-0">
                {getAgeGroupLabel(cycle.age_group)}
              </Badge>
              <span className="text-sm text-muted-foreground shrink-0">
                {cycle.start_year}/{cycle.end_year}
              </span>
              {cycle.is_active && <Badge className="shrink-0">Aktiv</Badge>}
            </button>
            {canWrite && (
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={cycle.is_active}
                  onCheckedChange={(val) => toggleCycleMut.mutate({ id: cycle.id, val })}
                  aria-label="Zyklus aktiv/inaktiv"
                />
                <Button variant="ghost" size="icon" onClick={() => openEditCycle(cycle)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleteCycleId(cycle.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 space-y-2">
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Keine Phasen angelegt.</p>
            ) : (
              <div className="space-y-2">
                {phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{phase.name}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {getPhaseTypeLabel(phase.phase_type)}
                      </Badge>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {phase.start_date} – {phase.end_date}
                      </span>
                      {phase.is_active && (
                        <Badge variant="default" className="shrink-0">Aktiv</Badge>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={phase.is_active}
                          onCheckedChange={(val) => togglePhaseMut.mutate({ id: phase.id, val })}
                          aria-label="Phase aktiv/inaktiv"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPhase(phase, cycle.age_group)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletePhaseId(phase.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canAddPhase && (
              <Button variant="outline" size="sm" onClick={() => openCreatePhase(cycle.id, cycle.age_group)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Phase hinzufügen
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saisonverwaltung</h1>
          <p className="text-muted-foreground">Saisonzyklen und Phasen verwalten</p>
        </div>
        {canWrite && (
          <Button onClick={openCreateCycle}>
            <Plus className="mr-2 h-4 w-4" /> Neuer Saisonzyklus
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Laden…</div>
      ) : cycles.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Keine Saisonzyklen"
          description="Erstelle den ersten Saisonzyklus, um loszulegen."
        />
      ) : (
        <div className="space-y-8">
          {/* Erwachsene */}
          {adultCycles.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Erwachsene</h2>
                <Badge variant="secondary">{adultCycles.length}</Badge>
              </div>
              <div className="space-y-3">
                {adultCycles.map(renderCycleCard)}
              </div>
            </section>
          )}

          {/* Jugend */}
          {youthCycles.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Jugend</h2>
                <Badge variant="secondary">{youthCycles.length}</Badge>
              </div>
              <div className="space-y-3">
                {youthCycles.map(renderCycleCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ─── Cycle Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={cycleFormOpen} onOpenChange={(o) => !o && closeCycleForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCycle ? 'Saisonzyklus bearbeiten' : 'Neuer Saisonzyklus'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-name">Name</Label>
              <Input
                id="cycle-name"
                value={cycleForm.name}
                onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                placeholder="z.B. Saison 2025/26"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cycle-age-group">Altersgruppe</Label>
              <Select
                value={cycleForm.age_group}
                onValueChange={(v) => setCycleForm({ ...cycleForm, age_group: v })}
              >
                <SelectTrigger id="cycle-age-group"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.age_group.map((ag) => (
                    <SelectItem key={ag} value={ag}>
                      {getAgeGroupLabel(ag)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-year">Startjahr</Label>
                <Input
                  id="start-year" type="number"
                  value={cycleForm.start_year}
                  onChange={(e) => setCycleForm({ ...cycleForm, start_year: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-year">Endjahr</Label>
                <Input
                  id="end-year" type="number"
                  value={cycleForm.end_year}
                  onChange={(e) => setCycleForm({ ...cycleForm, end_year: parseInt(e.target.value) || 0 })}
                />
                {errors.end_year && <p className="text-sm text-destructive">{errors.end_year}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="cycle-active"
                checked={cycleForm.is_active}
                onCheckedChange={(v) => setCycleForm({ ...cycleForm, is_active: v })}
              />
              <Label htmlFor="cycle-active">Aktiver Zyklus</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCycleForm}>Abbrechen</Button>
            <Button
              onClick={handleCycleSubmit}
              disabled={createCycleMut.isPending || updateCycleMut.isPending}
            >
              {editingCycle ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Phase Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={phaseFormOpen} onOpenChange={(o) => !o && closePhaseForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPhase ? 'Phase bearbeiten' : 'Neue Phase'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="phase-name">Name</Label>
              <Input
                id="phase-name"
                value={phaseForm.name}
                onChange={(e) => setPhaseForm({ ...phaseForm, name: e.target.value })}
                placeholder="z.B. Vorrunde 2025/26"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phase-type">Phasentyp</Label>
              <Select
                value={phaseForm.phase_type}
                onValueChange={(v) => setPhaseForm({ ...phaseForm, phase_type: v })}
              >
                <SelectTrigger id="phase-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdult(phaseParentAgeGroup) ? (
                    <>
                      <SelectItem value="first_half">Vorrunde</SelectItem>
                      <SelectItem value="second_half">Rückrunde</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="single_half">Halbrunde</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phase-start">Startdatum</Label>
                <Input
                  id="phase-start" type="date"
                  value={phaseForm.start_date}
                  onChange={(e) => setPhaseForm({ ...phaseForm, start_date: e.target.value })}
                />
                {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phase-end">Enddatum</Label>
                <Input
                  id="phase-end" type="date"
                  value={phaseForm.end_date}
                  onChange={(e) => setPhaseForm({ ...phaseForm, end_date: e.target.value })}
                />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phase-sort">Sortierung</Label>
              <Input
                id="phase-sort" type="number" min={0} max={10}
                value={phaseForm.sort_order}
                onChange={(e) => setPhaseForm({ ...phaseForm, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="phase-active"
                checked={phaseForm.is_active}
                onCheckedChange={(v) => setPhaseForm({ ...phaseForm, is_active: v })}
              />
              <Label htmlFor="phase-active">Aktive Phase</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePhaseForm}>Abbrechen</Button>
            <Button
              onClick={handlePhaseSubmit}
              disabled={createPhaseMut.isPending || updatePhaseMut.isPending}
            >
              {editingPhase ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Cycle Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteCycleId} onOpenChange={(o) => !o && setDeleteCycleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saisonzyklus löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle zugehörigen Phasen und verknüpften Daten werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteCycleId) deleteCycleMut.mutate(deleteCycleId); setDeleteCycleId(null); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Phase Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deletePhaseId} onOpenChange={(o) => !o && setDeletePhaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phase löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletePhaseId) deletePhaseMut.mutate(deletePhaseId); setDeletePhaseId(null); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
