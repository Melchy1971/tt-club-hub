/**
 * Settings-Typen
 *
 * Zentrale Typ-Definitionen für alle Settings-Seiten.
 * Steuert Navigation, Zugriff und Section-Struktur.
 */

import type { Permission } from './auth';

// ── Tab-Navigation ────────────────────────────────────────────

/**
 * Definition eines Settings-Tabs.
 *
 * `requiredPermission` ersetzt die frühere `minRoles`-Array-Prüfung.
 * Wird via `hasPermission(role, requiredPermission)` ausgewertet.
 *
 * Kein `requiredPermission` → für alle angemeldeten Nutzer sichtbar.
 *
 * Migrations-Mapping:
 *   minRoles: ['admin', 'developer']             → requiredPermission: 'admin:all'
 *   minRoles: ['admin', 'vorstand', 'developer'] → requiredPermission: 'settings:read'
 *   kein minRoles                                → kein requiredPermission
 */
export interface SettingsTabDef {
  id:                  string;
  label:               string;
  icon:                React.ElementType;
  /**
   * Minimale Permission für Sichtbarkeit dieses Tabs.
   * Nutzt das zentrale `hasPermission()`-System aus lib/permissions.
   */
  requiredPermission?: Permission;
  component:           React.ComponentType;
  /**
   * Optionale Gruppe für visuelle Trennung in der Sidebar.
   * Tabs gleicher Gruppe werden durch einen Divider gruppiert.
   */
  group?:              SettingsTabGroup;
}

export type SettingsTabGroup =
  | 'account'    // Profil, Sicherheit, Datenschutz, Benachrichtigungen
  | 'club'       // Vereinsdaten, Saisons, Spiellokale
  | 'system'     // Rollen, Rechte, Darstellung, Backup
  | 'danger';    // Gefahrenzone

// ── Section-Layout ────────────────────────────────────────────

/**
 * Props für SettingsSection.
 * Eine Section entspricht einer Card mit Title, Description und Inhalt.
 */
export interface SettingsSectionProps {
  title:        string;
  description?: string;
  children:     React.ReactNode;
  /** 'danger' zeichnet den Card-Rand in destructive-Farbe. */
  variant?:     'default' | 'danger';
  className?:   string;
}

// ── Save-Bar ──────────────────────────────────────────────────

export interface SettingsSaveBarProps {
  isDirty:   boolean;
  isSaving:  boolean;
  onSave:    () => void;
  onCancel:  () => void;
}

// ── useSettingsForm ───────────────────────────────────────────

import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { ZodSchema } from 'zod';

/**
 * Konfiguration für useSettingsForm.
 * TForm = Zod-infer-Typ des Schemas.
 * TData = Typ der Rohdaten aus der DB-Abfrage (oft leicht abweichend von TForm).
 */
export interface UseSettingsFormOptions<TForm extends FieldValues, TData = unknown> {
  /** React Query Key für die Quelldaten. */
  queryKey:      unknown[];
  /** Laden der aktuellen Werte aus der DB. */
  queryFn:       () => Promise<TData | null | undefined>;
  /** Zod-Schema für Validierung und Typisierung. */
  schema:        ZodSchema<TForm>;
  /** Fallback-Werte wenn keine DB-Daten vorhanden (leeres Formular). */
  defaultValues: TForm;
  /**
   * Transformiert DB-Daten in Formularwerte.
   * Typische Aufgabe: null → '', Zahlen → Strings für Inputs, etc.
   */
  dataToForm:    (data: NonNullable<TData>) => TForm;
  /** Speichert die validierten Formularwerte. */
  saveFn:        (values: TForm) => Promise<void>;
  /** Optionale Erfolgs-/Fehlermeldungen. */
  messages?:     { success?: string; error?: string };
  /** Callback nach erfolgreichem Speichern (z. B. refresh, signOut). */
  onSaved?:      () => void;
}

export interface UseSettingsFormReturn<TForm extends FieldValues> {
  form:       UseFormReturn<TForm, any, any>;
  /** True solange die initiale Query lädt. */
  isLoading:  boolean;
  /** True wenn `form.handleSubmit(saveFn)` läuft. */
  isSaving:   boolean;
  /** True wenn das Formular gegenüber dem zuletzt gespeicherten Stand geändert wurde. */
  isDirty:    boolean;
  /** Speichert – führt Zod-Validierung aus, dann `saveFn`. */
  save:       () => void;
  /** Setzt das Formular auf den zuletzt geladenen/gespeicherten Stand zurück. */
  cancel:     () => void;
}
