import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { profileInfoService } from '@/services/profileInfoService';
import { profileInfoKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Save, Pencil, X, KeyRound, Shield, Users, User, Trophy, Star, CalendarIcon, UserX, AlertTriangle } from 'lucide-react';
import { getAgeGroupLabel } from '@/constants/uiLabels';
import { cn } from '@/lib/utils';
import type { MemberProfileViewModel } from '@/types/viewModels';

const profileSchema = z.object({
  first_name: z.string().min(1, 'Vorname erforderlich').max(100),
  last_name: z.string().min(1, 'Nachname erforderlich').max(100),
  email: z.string().email('Ungültige E-Mail').max(255),
  phone: z.string().max(30).optional().or(z.literal('')),
  mobile: z.string().max(30).optional().or(z.literal('')),
  street: z.string().max(200).optional().or(z.literal('')),
  zip_code: z.string().max(10).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  date_of_birth: z.string().nullable().optional(),
  entry_date: z.string().nullable().optional(),
  ttr_rating: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0, 'Muss ≥ 0 sein').max(3500).nullable(),
  ),
  qttr_rating: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0, 'Muss ≥ 0 sein').max(3500).nullable(),
  ),
}).refine((data) => {
  if (data.entry_date && data.date_of_birth) {
    return data.entry_date >= data.date_of_birth;
  }
  return true;
}, {
  message: 'Mitglied seit darf nicht vor dem Geburtstag liegen',
  path: ['entry_date'],
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

const SYSTEM_ROLES = new Set(['admin', 'vorstand', 'trainer', 'spieler', 'mitglied', 'developer']);

function DisplayField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '–'}</p>
    </div>
  );
}

function ProfileHeader({ member, profileVM, user }: {
  member: any;
  profileVM: MemberProfileViewModel | null | undefined;
  user: any;
}) {
  const initials = member
    ? `${(member.first_name?.[0] ?? '').toUpperCase()}${(member.last_name?.[0] ?? '').toUpperCase()}`
    : '?';
  const fullName = member ? `${member.first_name} ${member.last_name}`.trim() : 'Unbekannt';

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar className="h-20 w-20 text-2xl shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold truncate">{fullName}</h2>
              <Badge variant={member?.is_active ? 'default' : 'secondary'}>
                {member?.is_active ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{member?.email ?? user?.email ?? '–'}</p>

            {(member?.qttr_rating != null || member?.ttr_rating != null) && (
              <div className="flex items-center gap-4 text-sm">
                <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                {member?.qttr_rating != null && <span>QTTR: <strong>{member.qttr_rating}</strong></span>}
                {member?.ttr_rating != null && <span className="text-muted-foreground">TTR: {member.ttr_rating}</span>}
              </div>
            )}

            {profileVM?.roles && profileVM.roles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                {profileVM.roles.map((r) => (
                  <Badge key={r.role} variant="outline" className="capitalize">{r.label}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TabPersonalData({ member, form, editing, setEditing, updateMut, changingPassword, setChangingPassword, pwForm, pwMut }: any) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Kontaktdaten</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v: ProfileForm) => updateMut.mutate(v))} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {([
                    ['first_name', 'Vorname', 'text'],
                    ['last_name', 'Nachname', 'text'],
                    ['email', 'E-Mail', 'email'],
                    ['phone', 'Telefon', 'text'],
                    ['mobile', 'Mobil', 'text'],
                    ['street', 'Straße', 'text'],
                    ['zip_code', 'PLZ', 'text'],
                    ['city', 'Ort', 'text'],
                  ] as const).map(([name, label, type]) => (
                    <FormField key={name} control={form.control} name={name} render={({ field }) => (
                      <FormItem>
                        <FormLabel>{label}</FormLabel>
                        <FormControl>
                          <Input {...field} type={type} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ))}

                  {/* Birthdate */}
                  <FormField control={form.control} name="date_of_birth" render={({ field }) => {
                    const dateValue = field.value ? new Date(field.value) : undefined;
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Geburtstag</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground',
                                )}
                              >
                                {dateValue ? format(dateValue, 'dd.MM.yyyy') : <span>Datum wählen</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateValue}
                              onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : null)}
                              disabled={(d) => d > new Date()}
                              initialFocus
                              className={cn('p-3 pointer-events-auto')}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }} />

                  {/* Mitglied seit */}
                  <FormField control={form.control} name="entry_date" render={({ field }) => {
                    const dateValue = field.value ? new Date(field.value) : undefined;
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Mitglied seit</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground',
                                )}
                              >
                                {dateValue ? format(dateValue, 'dd.MM.yyyy') : <span>Datum wählen</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dateValue}
                              onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : null)}
                              disabled={(d) => d > new Date()}
                              initialFocus
                              className={cn('p-3 pointer-events-auto')}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }} />

                  {/* TTR */}
                  <FormField control={form.control} name="ttr_rating" render={({ field }) => (
                    <FormItem>
                      <FormLabel>TTR</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0} max={3500} placeholder="0–3500"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* QTTR */}
                  <FormField control={form.control} name="qttr_rating" render={({ field }) => (
                    <FormItem>
                      <FormLabel>QTTR</FormLabel>
                      <FormControl>
                        <Input
                          type="number" min={0} max={3500} placeholder="0–3500"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)}
                        />
                      </FormControl>
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DisplayField label="Vorname" value={member?.first_name} />
              <DisplayField label="Nachname" value={member?.last_name} />
              <DisplayField label="E-Mail" value={member?.email} />
              <DisplayField label="Telefon" value={member?.phone} />
              <DisplayField label="Mobil" value={(member as any)?.mobile} />
              <DisplayField
                label="Geburtstag"
                value={member?.date_of_birth ? format(new Date(member.date_of_birth), 'dd.MM.yyyy') : null}
              />
              <DisplayField
                label="Mitglied seit"
                value={member?.entry_date ? format(new Date(member.entry_date), 'dd.MM.yyyy') : null}
              />
              <DisplayField label="Straße" value={member?.street} />
              <DisplayField label="PLZ" value={member?.zip_code} />
              <DisplayField label="Ort" value={member?.city} />
              <DisplayField label="TTR" value={member?.ttr_rating?.toString()} />
              <DisplayField label="QTTR" value={member?.qttr_rating?.toString()} />
              <DisplayField label="Status" value={member?.is_active ? 'Aktiv' : 'Inaktiv'} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Passwort ändern</CardTitle>
              <CardDescription>Neues Passwort für deinen Account festlegen</CardDescription>
            </div>
            {!changingPassword && (
              <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Ändern
              </Button>
            )}
          </div>
        </CardHeader>
        {changingPassword && (
          <CardContent>
            <Form {...pwForm}>
              <form onSubmit={pwForm.handleSubmit((v: PasswordForm) => pwMut.mutate(v))} className="space-y-4 max-w-md">
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

function TabRoles({ profileVM }: { profileVM: MemberProfileViewModel | null | undefined }) {
  if (!profileVM?.roles?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Keine Rollen zugewiesen.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zugewiesene Rollen</CardTitle>
        <CardDescription>Systemrollen bestimmen deine Berechtigungen in der Anwendung</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rolle</TableHead>
              <TableHead>Typ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profileVM.roles.map((r) => (
              <TableRow key={r.role}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{r.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={SYSTEM_ROLES.has(r.role) ? 'default' : 'secondary'}>
                    {SYSTEM_ROLES.has(r.role) ? 'Systemrolle' : 'Benutzerdefiniert'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TabSecurity({ profileVM }: { profileVM: MemberProfileViewModel | null | undefined }) {
  const permissions = profileVM?.permissions;
  if (!permissions) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Passwort & Sicherheit</CardTitle>
        <CardDescription>Self-Service und Admin/Vorstand-Berechtigungen im Profilkontext</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><strong>Modus:</strong> {permissions.mode === 'self-service' ? 'Self-Service' : 'Admin/Vorstand'}</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Badge variant={permissions.canEditPersonalData ? 'default' : 'secondary'}>Persönliche Daten bearbeiten</Badge>
          <Badge variant={permissions.canChangeOwnPassword ? 'default' : 'secondary'}>Eigenes Passwort ändern</Badge>
          <Badge variant={permissions.canManageRoles ? 'default' : 'secondary'}>Rollen verwalten</Badge>
          <Badge variant={permissions.canManageTeamAssignments ? 'default' : 'secondary'}>Mannschaften verwalten</Badge>
          <Badge variant={permissions.canManageSecurityForOthers ? 'default' : 'secondary'}>Sicherheit für andere verwalten</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TabTeams({ profileVM }: { profileVM: MemberProfileViewModel | null | undefined }) {
  if (!profileVM?.teams?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Keiner Mannschaft zugeordnet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mannschaften</CardTitle>
        <CardDescription>Deine aktuellen Teamzuordnungen</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mannschaft</TableHead>
              <TableHead className="hidden sm:table-cell">Altersgruppe</TableHead>
              <TableHead className="hidden md:table-cell">Saisonphase</TableHead>
              <TableHead className="hidden sm:table-cell">Liga</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="hidden md:table-cell">Kapitän</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profileVM.teamGroups.flatMap((group) => (
              group.teams.map((t, index) => (
                <TableRow key={t.teamId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <div>{t.name}</div>
                        {index === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Gruppe: {group.ageGroup ? getAgeGroupLabel(group.ageGroup) : '–'} · {group.seasonPhaseName ?? 'ohne Phase'}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {t.ageGroup ? getAgeGroupLabel(t.ageGroup) : '–'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{t.seasonPhaseName ?? '–'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{t.league ?? '–'}</TableCell>
                  <TableCell>{t.position || '–'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {t.isCaptain ? (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3" /> Ja
                      </Badge>
                    ) : '–'}
                  </TableCell>
                </TableRow>
              ))
            ))}
          </TableBody>
        </Table>
        <div className="mt-5 space-y-4">
          {profileVM.teams.map((team) => (
            <div key={`${team.teamId}-training`} className="space-y-1">
              <h4 className="text-sm font-medium">{team.name} – Trainingszeiten</h4>
              {team.trainingTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine geplanten Trainingszeiten.</p>
              ) : (
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {team.trainingTimes.map((slot) => (
                    <li key={slot.id}>
                      {slot.bookingDate} · {slot.startTime.slice(0, 5)}
                      {slot.endTime ? `-${slot.endTime.slice(0, 5)}` : ''} · {slot.location ?? 'Ort offen'} ({slot.status})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsProfile() {
  const { user, member, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: profileVM, isLoading } = useQuery({
    queryKey: profileInfoKeys.memberViewModel(user?.id ?? 'anonymous'),
    queryFn: () => profileInfoService.getMemberProfileViewModel(user!.id),
    enabled: !!user?.id,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', mobile: '',
      street: '', zip_code: '', city: '', date_of_birth: null,
      entry_date: null, ttr_rating: null, qttr_rating: null,
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
        mobile: (member as any).mobile ?? '',
        street: member.street ?? '',
        zip_code: member.zip_code ?? '',
        city: member.city ?? '',
        date_of_birth: member.date_of_birth ?? null,
        entry_date: member.entry_date ?? null,
        ttr_rating: member.ttr_rating ?? null,
        qttr_rating: member.qttr_rating ?? null,
      });
    }
  }, [member]);

  const updateMut = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!member) throw new Error('Kein Mitgliedsprofil');
      const payload: Record<string, any> = { ...values };
      // Convert empty strings to null for nullable fields
      for (const key of ['phone', 'mobile', 'street', 'zip_code', 'city'] as const) {
        if (payload[key] === '') payload[key] = null;
      }
      const { error } = await supabase.from('members').update(payload as any).eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Profil aktualisiert'); setEditing(false); refresh(); },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  const pwMut = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Passwort geändert'); setChangingPassword(false); pwForm.reset(); },
    onError: () => toast.error('Fehler beim Ändern des Passworts'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const deactivateMut = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error('Kein Profil');
      const { error } = await supabase
        .from('members')
        .update({ is_active: false, exit_date: new Date().toISOString().split('T')[0] })
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success('Konto deaktiviert');
      await signOut();
    },
    onError: () => toast.error('Fehler'),
  });

  return (
    <div className="space-y-6">
      <ProfileHeader member={member} profileVM={profileVM} user={user} />

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="personal" className="gap-1.5">
            <User className="h-4 w-4" /> Persönliche Daten
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="h-4 w-4" /> Rollen
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-4 w-4" /> Mannschaften
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <TabPersonalData
            member={member} form={form} editing={editing} setEditing={setEditing}
            updateMut={updateMut} changingPassword={changingPassword}
            setChangingPassword={setChangingPassword} pwForm={pwForm} pwMut={pwMut}
          />
        </TabsContent>

        <TabsContent value="roles">
          <div className="space-y-4">
            <TabRoles profileVM={profileVM} />
            <TabSecurity profileVM={profileVM} />
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <TabTeams profileVM={profileVM} />
        </TabsContent>
      </Tabs>

      {/* Konto deaktivieren */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5" />
            Konto deaktivieren
          </CardTitle>
          <CardDescription>
            Dein Mitgliedsprofil wird als inaktiv markiert. Du kannst dich danach nicht mehr anmelden.
            Um dies rückgängig zu machen, wende dich an einen Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <UserX className="mr-2 h-4 w-4" />
                Konto deaktivieren
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konto wirklich deaktivieren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion markiert dein Profil als inaktiv und setzt ein Austrittsdatum.
                  Um dies rückgängig zu machen, wende dich an einen Administrator.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deactivateMut.mutate()}
                >
                  Deaktivieren
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
