/**
 * @fileoverview Every translation uses the placeholder form lookup fills in
 * @author Oabona-Majoko
 * @created 2026-11-09
 * @lastModified 2026-11-09
 *
 * lookup() replaces {{name}} only. Strings written with {name} reached the
 * screen as typed: "Taken today at {time}", "{count} tries left".
 */

import { en } from '../locales/en';
import { af } from '../locales/af';
import { tn } from '../locales/tn';

const SINGLE_BRACE = /(?<!\{)\{[A-Za-z]+\}(?!\})/;

describe.each([['en', en], ['af', af], ['tn', tn]] as const)('%s translations', (_name, strings) => {
  it('use {{name}} placeholders, never {name}', () => {
    const wrong = Object.entries(strings as Record<string, string>).filter(([, text]) => SINGLE_BRACE.test(text));
    expect(wrong).toEqual([]);
  });
});
