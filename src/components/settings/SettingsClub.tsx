import { useEffect } from 'react';
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
import { Save } from 'lucide-react';

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
      toast.success('Vereinsdaten gespeichert');
    },
    onError: () => toast.error('Fehler beim Speichern'),
  });

  return (
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
  );
}
