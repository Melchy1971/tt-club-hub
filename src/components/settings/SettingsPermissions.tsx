import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import {
  MODULE_KEYS,
  getModuleLabel,
  permissionLabels,
  isPermissionLevel,
  type ModuleKey,
  type PermissionLevel,
} from '@/constants/permissionsMatrix';

const ROLES: Database['public']['Enums']['app_role'][] = [
  'admin', 'vorstand', 'trainer', 'spieler', 'mitglied',
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', vorstand: 'Vorstand', trainer: 'Trainer',
  spieler: 'Spieler', mitglied: 'Mitglied',
};

export default function SettingsPermissions() {
  const queryClient = useQueryClient();

  const { data: permissions = [] } = useQuery({
    queryKey: ['role-module-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role_module_permissions').select('*');
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ role, module, level }: { role: string; module: ModuleKey; level: PermissionLevel }) => {
      const existing = permissions.find((p) => p.role === role && p.module === module);
      if (existing) {
        const { error } = await supabase.from('role_module_permissions')
          .update({ level })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('role_module_permissions')
          .insert({ role: role as any, module, level });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
      toast.success('Berechtigung aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const getLevel = (role: string, module: ModuleKey): PermissionLevel => {
    const found = permissions.find((p) => p.role === role && p.module === module);
    return found?.level ?? 'none';
  };

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
                {ROLES.map((r) => (
                  <TableHead key={r} className="text-center min-w-[120px]">
                    {ROLE_LABELS[r]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_KEYS.map((mod) => (
                <TableRow key={mod}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium">{getModuleLabel(mod)}</TableCell>
                  {ROLES.map((role) => {
                    const level = getLevel(role, mod);
                    return (
                      <TableCell key={role} className="text-center">
                        <Select
                          value={level}
                          onValueChange={(value) => {
                            if (!isPermissionLevel(value)) return;
                            updateMut.mutate({ role, module: mod, level: value });
                          }}
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
