import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  APP_ROLE_LABELS,
  MODULE_KEYS,
  getModuleLabel,
  permissionLabels,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';
import {
  assertRoleMutable,
  resolveRolePermissions,
  validateRolePermissionsPayload,
  type RolePermissionsMap,
} from '@/lib/auth/permissionsResolver';

export default function SettingsPermissions() {
  const queryClient = useQueryClient();

  const { data: roles = [] } = useQuery({
    queryKey: ['role-module-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('id, name, permissions, is_system').order('name');
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ roleId, nextPermissions }: { roleId: string; nextPermissions: RolePermissionsMap }) => {
      const validation = validateRolePermissionsPayload(nextPermissions);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      const { error } = await supabase
        .from('roles')
        .update({ permissions: nextPermissions } as never)
        .eq('id', roleId);
      if (error) throw error;
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
                    {APP_ROLE_LABELS[role.name]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_KEYS.map((mod) => (
                <TableRow key={mod}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium">{getModuleLabel(mod)}</TableCell>
                  {roles.map((role) => {
                    const matrix = resolveRolePermissions(role);
                    const level = matrix[mod];
                    const mutability = assertRoleMutable(role);

                    return (
                      <TableCell key={role.id} className="text-center">
                        <Select
                          value={level}
                          onValueChange={(value) => {
                            const nextPermissions: RolePermissionsMap = { ...matrix, [mod]: value as PermissionLevel };
                            const validation = validateRolePermissionsPayload(nextPermissions);
                            if (!validation.valid || !mutability.mutable) return;
                            updateMut.mutate({ roleId: role.id, nextPermissions });
                          }}
                          disabled={!mutability.mutable}
                        >
                          <SelectTrigger className="h-8 w-24 mx-auto text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(permissionLabels) as [PermissionLevel, string][]).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
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
