import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { AppRole } from '@/types/auth';
import {
  MODULE_KEYS,
  SYSTEM_APP_ROLES,
  type ModuleKey,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';
import {
  APP_ROLE_LABELS,
  MODULE_LABELS,
  PERMISSION_LEVEL_LABELS,
} from '@/constants/permissionLabels';
import {
  assertRoleMutable,
  resolveRolePermissions,
  validateRolePermissionsPayload,
  type RolePermissionsMap,
  type RoleWithPermissions,
} from '@/lib/auth/permissionsResolver';

type PermLevel = PermissionLevel;

const LEVEL_COLORS: Record<PermLevel, string> = {
  none: 'bg-muted text-muted-foreground',
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  write: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

interface RoleModulePerm {
  roleId: string;
  roleName: AppRole;
  module: ModuleKey;
  level: PermLevel;
  isSystem: boolean;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
}

async function fetchPermissions(): Promise<RoleModulePerm[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, permissions, is_system')
    .order('name');
  if (error) throw error;

  return ((data ?? []) as RoleWithPermissions[]).flatMap((role) => {
    const permissions = resolveRolePermissions(role);
    return MODULE_KEYS.map((module): RoleModulePerm => ({
      roleId: role.id,
      roleName: role.name,
      module,
      level: permissions[module],
      isSystem: !!role.is_system,
    }));
  });
}

async function fetchUserRoles(): Promise<UserRoleRow[]> {
  const { data, error } = await supabase.from('user_roles').select('id, user_id, role');
  if (error) throw error;
  return (data ?? []) as UserRoleRow[];
}

async function fetchMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('members')
    .select('id, user_id, first_name, last_name, email')
    .not('user_id', 'is', null)
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as MemberRow[];
}

export default function Roles() {
  const queryClient = useQueryClient();
  const { role: currentRole } = useAuth();
  const admin = isAdmin(currentRole);

  const { data: perms = [] } = useQuery({ queryKey: ['role_perms'], queryFn: fetchPermissions });
  const { data: userRoles = [] } = useQuery({ queryKey: ['user_roles'], queryFn: fetchUserRoles });
  const { data: members = [] } = useQuery({ queryKey: ['members_linked'], queryFn: fetchMembers });

  const [editedPerms, setEditedPerms] = useState<Record<string, PermLevel>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState<AppRole | ''>('');

  const permLookup = (role: AppRole, module: ModuleKey): PermLevel => {
    const key = `${role}:${module}`;
    if (editedPerms[key] !== undefined) return editedPerms[key];
    const found = perms.find((p) => p.roleName === role && p.module === module);
    return found?.level ?? 'none';
  };

  const hasChanges = Object.keys(editedPerms).length > 0;

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const [key, level] of Object.entries(editedPerms)) {
        const [role, module] = key.split(':');
        const roleName = role as AppRole;
        const moduleKey = module as ModuleKey;

        const roleEntries = perms.filter((entry) => entry.roleName === roleName);
        const roleEntry = roleEntries[0];
        if (!roleEntry) throw new Error(`Rolle ${roleName} nicht gefunden`);

        const mutability = assertRoleMutable({
          id: roleEntry.roleId,
          name: roleName,
          is_system: roleEntry.isSystem,
        });
        if (!mutability.mutable) throw new Error(mutability.reason);

        const currentMatrix = roleEntries.reduce((acc, entry) => ({
          ...acc,
          [entry.module]: entry.level,
        }), {} as RolePermissionsMap);

        const nextPermissions: RolePermissionsMap = { ...currentMatrix, [moduleKey]: level };
        const validation = validateRolePermissionsPayload(nextPermissions);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }

        const { error } = await supabase
          .from('roles')
          .update({ permissions: nextPermissions } as never)
          .eq('id', roleEntry.roleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Berechtigungen gespeichert');
      setEditedPerms({});
      queryClient.invalidateQueries({ queryKey: ['role_perms'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rolle zugewiesen');
      setAssignOpen(false);
      setAssignUserId('');
      setAssignRole('');
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Rolle entfernt');
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setPermLevel(role: AppRole, module: ModuleKey, level: PermLevel) {
    setEditedPerms((prev) => ({ ...prev, [`${role}:${module}`]: level }));
  }

  function getMemberName(userId: string) {
    const m = members.find((mb) => mb.user_id === userId);
    return m ? `${m.last_name}, ${m.first_name}` : userId.slice(0, 8) + '…';
  }

  const assignableMembers = members.filter((m) => m.user_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rollen & Berechtigungen</h1>
          <p className="text-muted-foreground">Systemrollen und Modul-Berechtigungen verwalten</p>
        </div>
        {admin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Rolle zuweisen
            </Button>
            {hasChanges && (
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save className="mr-2 h-4 w-4" /> Speichern
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Rechte-Matrix</TabsTrigger>
          <TabsTrigger value="assignments">Rollenzuweisungen</TabsTrigger>
          <TabsTrigger value="roles">Rollenliste</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">Modul</TableHead>
                  {SYSTEM_APP_ROLES.map((r) => (
                    <TableHead key={r} className="text-center min-w-[120px]">
                      {APP_ROLE_LABELS[r] ?? r}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULE_KEYS.map((mod) => (
                  <TableRow key={mod}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">
                      {MODULE_LABELS[mod]}
                    </TableCell>
                    {SYSTEM_APP_ROLES.map((role) => {
                      const level = permLookup(role, mod);
                      return (
                        <TableCell key={role} className="text-center p-1">
                          {admin ? (
                            <Select
                              value={level}
                              onValueChange={(v) => setPermLevel(role, mod, v as PermLevel)}
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(PERMISSION_LEVEL_LABELS) as [PermLevel, string][]).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-xs ${LEVEL_COLORS[level]}`}>
                              {PERMISSION_LEVEL_LABELS[level]}
                            </Badge>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          {userRoles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Keine Rollenzuweisungen vorhanden.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitglied</TableHead>
                    <TableHead>Rolle</TableHead>
                    {admin && <TableHead className="text-right">Aktion</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map((ur) => (
                    <TableRow key={ur.id}>
                      <TableCell className="font-medium">{getMemberName(ur.user_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{APP_ROLE_LABELS[ur.role] ?? ur.role}</Badge>
                      </TableCell>
                      {admin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeMut.mutate(ur.id)}
                          >
                            Entfernen
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Zugewiesene Nutzer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SYSTEM_APP_ROLES.map((r) => {
                  const count = userRoles.filter((ur) => ur.role === r).length;
                  return (
                    <TableRow key={r}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          {APP_ROLE_LABELS[r] ?? r}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">Systemrolle</Badge>
                      </TableCell>
                      <TableCell>{count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={assignOpen} onOpenChange={(o) => !o && setAssignOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rolle zuweisen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mitglied</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Mitglied auswählen" /></SelectTrigger>
                <SelectContent>
                  {assignableMembers.map((m) => (
                    <SelectItem key={m.user_id!} value={m.user_id!}>
                      {m.last_name}, {m.first_name} {m.email ? `(${m.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select value={assignRole} onValueChange={(v) => setAssignRole(v as AppRole)}>
                <SelectTrigger><SelectValue placeholder="Rolle auswählen" /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{APP_ROLE_LABELS[r] ?? r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!assignUserId || !assignRole) {
                  toast.error('Bitte Mitglied und Rolle auswählen');
                  return;
                }
                assignMut.mutate({ userId: assignUserId, role: assignRole as AppRole });
              }}
              disabled={assignMut.isPending}
            >
              Zuweisen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
