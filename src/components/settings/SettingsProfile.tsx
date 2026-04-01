import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, Pencil, X, KeyRound, Users, Trophy, Shield } from 'lucide-react';

const profileSchema = z.object({
  first_name: z.string().min(1, 'Vorname erforderlich').max(100),
  last_name: z.string().min(1, 'Nachname erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  street: z.string().max(200).optional().or(z.literal('')),
  zip_code: z.string().max(10).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'Mindestens 8 Zeichen'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirm'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsProfile() {
  const { user, member, role, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch user roles
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!user?.id,
  });

  // Fetch teams for this member
  const { data: teams } = useQuery({
    queryKey: ['member-teams', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data } = await supabase
        .from('team_members')
        .select('team_id, teams(name, league)')
        .eq('member_id', member.id);
      return data ?? [];
    },
    enabled: !!member?.id,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '',
      phone: '', street: '', zip_code: '', city: '',
    },
  });

  const pwForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    if (member) {
      form.reset({
        first_name: member.first_name ?? '',
        last_name: member.last_name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        street: member.street ?? '',
        zip_code: member.zip_code ?? '',
        city: member.city ?? '',
      });
    }
  }, [member]);

  const updateMut = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!member) throw new Error('Kein Mitgliedsprofil');
      const { error } = await supabase
        .from('members')
        .update(values)
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profil aktualisiert');
      setEditing(false);
      refresh();
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const pwMut = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Passwort geändert');
      setChangingPassword(false);
      pwForm.reset();
    },
    onError: () => toast.error('Fehler beim Ändern des Passworts'),
  });

  const initials = member
    ? `${(member.first_name?.[0] ?? '').toUpperCase()}${(member.last_name?.[0] ?? '').toUpperCase()}`
    : '?';

  const fullName = member ? `${member.first_name} ${member.last_name}` : 'Unbekannt';

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin', vorstand: 'Vorstand', trainer: 'Trainer',
    spieler: 'Spieler', mitglied: 'Mitglied', developer: 'Developer',
  };

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">{fullName}</h2>
                <Badge variant={member?.is_active ? 'default' : 'secondary'}>
                  {member?.is_active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{member?.email ?? user?.email ?? '–'}</p>

              {/* QTTR Rating */}
              {(member?.qttr_rating || member?.ttr_rating) && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    {member?.qttr_rating != null && (
                      <span>QTTR: <strong>{member.qttr_rating}</strong></span>
                    )}
                    {member?.ttr_rating != null && (
                      <span className="text-muted-foreground ml-2">TTR: {member.ttr_rating}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Roles */}
              {userRoles && userRoles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  {userRoles.map((r) => (
                    <Badge key={r} variant="outline" className="capitalize">
                      {ROLE_LABELS[r] ?? r}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Teams */}
              {teams && teams.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {teams.map((t: any) => (
                    <Badge key={t.team_id} variant="secondary">
                      {t.teams?.name}{t.teams?.league ? ` (${t.teams.league})` : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Profil bearbeiten</CardTitle>
            <CardDescription>Persönliche Daten und Kontaktinformationen</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => updateMut.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vorname</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nachname</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-Mail</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="street" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Straße</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="zip_code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PLZ</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ort</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setEditing(false); form.reset(); }}>
                    <X className="mr-2 h-4 w-4" /> Abbrechen
                  </Button>
                  <Button type="submit" disabled={updateMut.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Speichern
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Password Change */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Passwort ändern</CardTitle>
              <CardDescription>Neues Passwort für deinen Account festlegen</CardDescription>
            </div>
            {!changingPassword && (
              <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Passwort ändern
              </Button>
            )}
          </div>
        </CardHeader>
        {changingPassword && (
          <CardContent>
            <Form {...pwForm}>
              <form onSubmit={pwForm.handleSubmit((v) => pwMut.mutate(v))} className="space-y-4 max-w-md">
                <FormField control={pwForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neues Passwort</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={pwForm.control} name="confirm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passwort bestätigen</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setChangingPassword(false); pwForm.reset(); }}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={pwMut.isPending}>
                    <Save className="mr-2 h-4 w-4" /> Speichern
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
