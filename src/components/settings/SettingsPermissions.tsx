import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canManageRoles } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  MODULE_KEYS,
  type ModuleKey,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';
import {
  APP_ROLE_LABELS,
  getModuleLabel,
  PERMISSION_LEVEL_LABELS,
} from '@/constants/permissionLabels';
import type { Enums } from '@/integrations/supabase/types';

type DbPermissionLevel = Enums<'permission_level'>; // 'none' | 'read' | 'write'
type DbAppRole = Enums<'app_role'>;

interface RoleRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
}

const toDbLevel = (level: PermissionLevel): DbPermissionLevel =>
  level.toLowerCase() as DbPermissionLevel;

const fromDbLevel = (level: DbPermissionLevel): PermissionLevel =>
  level.toUpperCase() as PermissionLevel;

const EMPTY_FORM = { displayName: '', description: '' };

export default function SettingsPermissions() {
  const queryClient = useQueryClient();
  const { role: currentRole } = useAuth();
  const canEdit = canManageRoles(currentRole);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, display_name, description, is_system')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as RoleRow[];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['role-module-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_module_permissions')
        .select('id, role, module, level');
      if (error) throw error;
      return data ?? [];
    },
  });

  const getLevel = (roleName: string, mod: ModuleKey): PermissionLevel => {
    const entry = permissions.find((p) => p.role === roleName && p.module === mod);
    return entry ? fromDbLevel(entry.level) : 'NONE';
  };

  const updatePermMut = useMutation({
    mutationFn: async ({ role, module, level }: { role: DbAppRole; module: string; level: DbPermissionLevel }) => {
      const existing = permissions.find((p) => p.role === role && p.module === module);
      if (existing) {
        const { error } = await supabase.from('role_module_permissions').update({ level }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('role_module_permissions').insert({ role, module, level });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
      toast.success('Berechtigung aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const createMut = useMutation({
    mutationFn: async ({ displayName, description }: { displayName: string; description: string }) => {
      const slug = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const { error } = await supabase
        .from('roles')
        .insert({ display_name: displayName, description: description || null, name: slug, is_system: false } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rolle angelegt');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['roles-list'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMut = useMutation({
    mutationFn: async ({ id, displayName, description }: { id: string; displayName: string; description: string }) => {
      const { error } = await supabase
        .from('roles')
        .update({ display_name: displayName, description: description || null } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rolle aktualisiert');
      setEditTarget(null);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['roles-list'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rolle gelöscht');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['roles-list'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(role: RoleRow) {
    setForm({ displayName: role.display_name, description: role.description ?? '' });
    setEditTarget(role);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rollen & Rechte Matrix</CardTitle>
            <CardDescription>Feingranulare Zugriffssteuerung pro Modul und Rolle</CardDescription>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Neue Rolle
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Modul</TableHead>
                {roles.map((role) => (
                  <TableHead key={role.id} className="text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span>{APP_ROLE_LABELS[role.name as keyof typeof APP_ROLE_LABELS] ?? role.display_name}</span>
                      {canEdit && !role.is_system && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(role)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(role)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_KEYS.map((mod) => (
                <TableRow key={mod}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium">
                    {getModuleLabel(mod)}
                  </TableCell>
                  {roles.map((role) => {
                    const level = getLevel(role.name, mod);
                    return (
                      <TableCell key={role.id} className="text-center">
                        <Select
                          value={level}
                          disabled={!canEdit}
                          onValueChange={(value) => {
                            updatePermMut.mutate({
                              role: role.name as DbAppRole,
                              module: mod,
                              level: toDbLevel(value as PermissionLevel),
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 w-24 mx-auto text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(PERMISSION_LEVEL_LABELS) as [PermissionLevel, string][]).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Rolle anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Anzeigename <span className="text-destructive">*</span></Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="z. B. Kassenwart"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kurze Beschreibung…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!form.displayName.trim()) { toast.error('Bitte einen Anzeigenamen eingeben'); return; }
                createMut.mutate({ displayName: form.displayName.trim(), description: form.description.trim() });
              }}
              disabled={createMut.isPending}
            >
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rolle bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Anzeigename <span className="text-destructive">*</span></Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beschreibung</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!form.displayName.trim()) { toast.error('Bitte einen Anzeigenamen eingeben'); return; }
                editMut.mutate({ id: editTarget!.id, displayName: form.displayName.trim(), description: form.description.trim() });
              }}
              disabled={editMut.isPending}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rolle löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Soll die Rolle <strong>{deleteTarget?.display_name}</strong> unwiderruflich gelöscht werden?
              Alle zugewiesenen Nutzer verlieren diese Rolle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
