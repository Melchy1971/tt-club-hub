import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Upload, X, Image as ImageIcon } from 'lucide-react';
import { profileInfoKeys } from '@/lib/queryKeys';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const clubSchema = z.object({
  club_name: z.string().min(1, 'Vereinsname erforderlich').max(200),
  club_number: z.string().max(50).optional().or(z.literal('')),
  association: z.string().max(200).optional().or(z.literal('')),
  contact_email: z.string().email('Ungültige E-Mail').max(255).optional().or(z.literal('')),
  contact_phone: z.string().max(30).optional().or(z.literal('')),
  website: z.string().max(255).optional().or(z.literal('')),
  street: z.string().max(200).optional().or(z.literal('')),
  zip_code: z.string().max(10).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
});

type ClubForm = z.infer<typeof clubSchema>;

export default function SettingsClub() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['club-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('club_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<ClubForm>({
    resolver: zodResolver(clubSchema),
    defaultValues: { club_name: '', club_number: '', association: '', contact_email: '', contact_phone: '', website: '', street: '', zip_code: '', city: '' },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        club_name: settings.club_name ?? '',
        club_number: settings.club_number ?? '',
        association: settings.association ?? '',
        contact_email: settings.contact_email ?? '',
        contact_phone: settings.contact_phone ?? '',
        website: settings.website ?? '',
        street: settings.street ?? '',
        zip_code: settings.zip_code ?? '',
        city: settings.city ?? '',
      });
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Bitte eine Bilddatei auswählen');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Maximale Dateigröße: 2 MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `logo_${settings.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('club-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('club-logos').getPublicUrl(path);

      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('club_settings')
        .update({ logo_url: logoUrl })
        .eq('id', settings.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['club-settings'] });
      queryClient.invalidateQueries({ queryKey: profileInfoKeys.publicClubInfo() });
      toast.success('Logo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!settings?.id) return;
    try {
      const { error } = await supabase
        .from('club_settings')
        .update({ logo_url: null })
        .eq('id', settings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['club-settings'] });
      queryClient.invalidateQueries({ queryKey: profileInfoKeys.publicClubInfo() });
      toast.success('Logo entfernt');
    } catch {
      toast.error('Fehler beim Entfernen');
    }
  };

  const saveMut = useMutation({
    mutationFn: async (values: ClubForm) => {
      if (settings?.id) {
        const { error } = await supabase.from('club_settings').update(values).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('club_settings').insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-settings'] });
      queryClient.invalidateQueries({ queryKey: profileInfoKeys.publicClubInfo() });
      toast.success('Vereinsdaten gespeichert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vereinslogo</CardTitle>
          <CardDescription>Logo wird im Header und in der Seitenleiste angezeigt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 rounded-lg">
              {settings?.logo_url ? (
                <AvatarImage src={settings.logo_url} alt="Vereinslogo" className="object-contain" />
              ) : null}
              <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading || !settings?.id}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? 'Wird hochgeladen…' : 'Logo hochladen'}
                </Button>
                {settings?.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleLogoRemove}>
                    <X className="mr-2 h-4 w-4" /> Entfernen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPG oder SVG. Max. 2 MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vereinsdaten</CardTitle>
          <CardDescription>Stammdaten und Kontaktdaten des Vereins</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMut.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['club_name', 'Vereinsname'],
                  ['club_number', 'Vereinsnummer'],
                  ['association', 'Verband'],
                  ['contact_email', 'Kontakt-E-Mail'],
                  ['contact_phone', 'Telefon'],
                  ['website', 'Website'],
                  ['street', 'Straße'],
                  ['zip_code', 'PLZ'],
                  ['city', 'Ort'],
                ] as const).map(([name, label]) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saveMut.isPending}>
                  <Save className="mr-2 h-4 w-4" /> Speichern
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
