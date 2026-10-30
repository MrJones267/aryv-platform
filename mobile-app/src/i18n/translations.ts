/**
 * @fileoverview Translation strings for multi-language support
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-10-30
 *
 * The strings live in ./locales, one file per language.
 */

import { en, TranslationKey } from './locales/en';
import { tn } from './locales/tn';
import { af } from './locales/af';

export type { TranslationKey };

export const translations: Record<string, Record<TranslationKey, string>> = {
  en,
  tn,
  af,
};

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'tn', name: 'Tswana', nativeName: 'Setswana' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
] as const;

export default translations;
