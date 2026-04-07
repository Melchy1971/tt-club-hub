import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
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

const toDbLevel = (level: PermissionLevel): DbPermissionLevel =>
  level.toLowerCase() as DbPermissionLevel;

const fromDbLevel = (level: DbPermissionLevel): PermissionLevel =>
  level.toUpperCase() as PermissionLevel;

export default function SettingsPermissions() {
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, display_name')
        .order('name');
      if (error) throw error;
      return data ?? [];
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
    const entry = permissions.find(
      (p) => p.role === roleName && p.module === mod,
    );
    return entry ? fromDbLevel(entry.level) : 'NONE';
  };

  const updateMut = useMutation({
    mutationFn: async ({
      role,
      module,
      level,
    }: {
      role: DbAppRole;
      module: string;
      level: DbPermissionLevel;
    }) => {
      const existing = permissions.find(
        (p) => p.role === role && p.module === module,
      );

      if (existing) {
        const { error } = await supabase
          .from('role_module_permissions')
          .update({ level })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_module_permissions')
          .insert({ role, module, level });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
      toast.success('Berechtigung aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rollen & Rechte Matrix</CardTitle>
        <CardDescription>Feingranulare Zugriffssteuerung pro Modul und Rolle</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Modul</TableHead>
                {roles.map((role) => (
                  <TableHead key={role.id} className="text-center min-w-[120px]">
                    {APP_ROLE_LABELS[role.name as keyof typeof APP_ROLE_LABELS] ?? role.display_name}
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
                          onValueChange={(value) => {
                            updateMut.mutate({
                              role: role.name,
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
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
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
    </Card>
  );
}
