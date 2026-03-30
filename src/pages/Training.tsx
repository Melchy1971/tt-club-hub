import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TrainingBookingDialog } from '@/components/training/TrainingBookingDialog';
import type { Member } from '@/types';

interface TrainingBooking {
  id: string;
  requester_id: string;
  partner_id: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  cancelled: 'Abgesagt',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  confirmed: 'default',
  cancelled: 'destructive',
};

function formatGermanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatTime(time: string | null): string {
  if (!time) return '–';
  return time.slice(0, 5);
}

export default function Training() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<TrainingBooking | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ['members-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('last_name');
      if (error) throw error;
      return data as Member[];
    },
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['training-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_bookings')
        .select('*')
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as TrainingBooking[];
    },
  });

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  const getMemberName = (id: string) => {
    const m = memberMap.get(id);
    return m ? `${m.first_name} ${m.last_name}` : '–';
  };

  const createMutation = useMutation({
    mutationFn: async (input: Omit<TrainingBooking, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      const { error } = await supabase.from('training_bookings').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast.success('Buchung erstellt');
    },
    onError: () => toast.error('Fehler beim Erstellen'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingBooking> & { id: string }) => {
      const { error } = await supabase.from('training_bookings').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast.success('Buchung aktualisiert');
    },
    onError: () => toast.error('Fehler beim Aktualisieren'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-bookings'] });
      toast.success('Buchung gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const handleSave = (data: {
    requester_id: string;
    partner_id: string;
    booking_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    note: string | null;
    status?: 'pending' | 'confirmed' | 'cancelled';
  }) => {
    if (editBooking) {
      updateMutation.mutate({ id: editBooking.id, ...data });
    } else {
      createMutation.mutate({ ...data, created_by: user!.id });
    }
    setDialogOpen(false);
    setEditBooking(null);
  };

  const handleEdit = (booking: TrainingBooking) => {
    setEditBooking(booking);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleStatusToggle = (booking: TrainingBooking) => {
    const nextStatus: Record<string, 'confirmed' | 'cancelled' | 'pending'> = {
      pending: 'confirmed',
      confirmed: 'cancelled',
      cancelled: 'pending',
    };
    updateMutation.mutate({ id: booking.id, status: nextStatus[booking.status] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="page-title">Training</h1>
          <p className="page-description">Trainingspartner-Buchungen verwalten</p>
        </div>
        <Button onClick={() => { setEditBooking(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Buchung
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : !bookings?.length ? (
        <p className="text-muted-foreground text-center py-12">Noch keine Buchungen vorhanden.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>Anfragender</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notiz</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{formatGermanDate(b.booking_date)}</TableCell>
                  <TableCell>
                    {formatTime(b.start_time)}
                    {b.end_time ? ` – ${formatTime(b.end_time)}` : ''}
                  </TableCell>
                  <TableCell>{getMemberName(b.requester_id)}</TableCell>
                  <TableCell>{getMemberName(b.partner_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{b.location ?? '–'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANTS[b.status]}
                      className="cursor-pointer"
                      onClick={() => handleStatusToggle(b)}
                    >
                      {STATUS_LABELS[b.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {b.note ?? '–'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TrainingBookingDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditBooking(null); }}
        members={members ?? []}
        booking={editBooking}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buchung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Buchung wird dauerhaft entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
