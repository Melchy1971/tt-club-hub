import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
}

interface TrainingBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  booking: TrainingBooking | null;
  onSave: (data: {
    requester_id: string;
    partner_id: string;
    booking_date: string;
    start_time: string;
    end_time: string | null;
    location: string | null;
    note: string | null;
    status?: 'pending' | 'confirmed' | 'cancelled';
  }) => void;
}

export function TrainingBookingDialog({
  open,
  onOpenChange,
  members,
  booking,
  onSave,
}: TrainingBookingDialogProps) {
  const [requesterId, setRequesterId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');

  useEffect(() => {
    if (booking) {
      setRequesterId(booking.requester_id);
      setPartnerId(booking.partner_id);
      setBookingDate(booking.booking_date);
      setStartTime(booking.start_time?.slice(0, 5) ?? '');
      setEndTime(booking.end_time?.slice(0, 5) ?? '');
      setLocation(booking.location ?? '');
      setNote(booking.note ?? '');
      setStatus(booking.status);
    } else {
      setRequesterId('');
      setPartnerId('');
      setBookingDate('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setNote('');
      setStatus('pending');
    }
  }, [booking, open]);

  const isValid = requesterId && partnerId && bookingDate && startTime && requesterId !== partnerId;

  const handleSubmit = () => {
    if (!isValid) return;
    onSave({
      requester_id: requesterId,
      partner_id: partnerId,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime || null,
      location: location || null,
      note: note || null,
      ...(booking ? { status } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{booking ? 'Buchung bearbeiten' : 'Neue Buchung'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Anfragender Spieler</Label>
            <Select value={requesterId} onValueChange={setRequesterId}>
              <SelectTrigger>
                <SelectValue placeholder="Spieler auswählen" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Trainingspartner</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Partner auswählen" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter((m) => m.id !== requesterId)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Datum</Label>
              <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Startzeit</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Endzeit (optional)</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Ort (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Halle 1" />
            </div>
          </div>

          {booking && (
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="confirmed">Bestätigt</SelectItem>
                  <SelectItem value="cancelled">Abgesagt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Notiz (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Fokus auf Aufschlag"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {booking ? 'Speichern' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
