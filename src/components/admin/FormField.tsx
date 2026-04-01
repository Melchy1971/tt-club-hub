/**
 * FormField
 *
 * Generisches Formularfeld mit Label, Input und optionalem Fehlertext.
 * Extrahiert aus Members.tsx (war dort lokal definiert).
 *
 * Für komplexere Felder (Select, Switch, Textarea) weiterhin direkt
 * die shadcn/ui-Komponenten verwenden.
 *
 * Verwendung:
 *
 * ```tsx
 * <FormField
 *   label="Vorname *"
 *   id="first_name"
 *   value={crud.form.first_name}
 *   error={crud.errors.first_name}
 *   onChange={(v) => crud.setField('first_name', v)}
 * />
 *
 * <FormField
 *   label="E-Mail"
 *   id="email"
 *   type="email"
 *   value={crud.form.email}
 *   onChange={(v) => crud.setField('email', v)}
 * />
 *
 * <FormField
 *   label="Geburtsdatum"
 *   id="date_of_birth"
 *   type="date"
 *   value={crud.form.date_of_birth}
 *   onChange={(v) => crud.setField('date_of_birth', v)}
 * />
 * ```
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label:      string;
  id:         string;
  value:      string;
  onChange:   (value: string) => void;
  type?:      string;
  error?:     string;
  placeholder?: string;
  disabled?:  boolean;
  className?: string;
}

export function FormField({
  label,
  id,
  value,
  onChange,
  type        = 'text',
  error,
  placeholder,
  disabled,
  className,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'border-destructive' : undefined}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
