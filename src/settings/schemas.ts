import { z } from 'zod';

export const trimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen erlaubt`);

export const optionalTrimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Maximal ${max} Zeichen erlaubt`)
    .optional()
    .or(z.literal(''));

export const emailSchema = z.string().trim().email('Ungültige E-Mail-Adresse');

export const optionalUrlSchema = z
  .string()
  .trim()
  .url('Ungültige URL')
  .optional()
  .or(z.literal(''));

export const booleanWithDefault = (defaultValue = false) => z.boolean().default(defaultValue);
