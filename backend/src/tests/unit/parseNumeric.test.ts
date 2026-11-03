/**
 * @fileoverview Unit tests for reading Postgres NUMERIC as numbers
 * @author Oabona-Majoko
 * @created 2026-11-03
 * @lastModified 2026-11-03
 *
 * DECIMAL columns were sent to the app as strings ("150.00"), and the app's
 * price.toFixed(2) threw on them.
 */

import { DataTypes } from 'sequelize';
import { parseNumeric } from '../../config/database';

describe('parseNumeric', () => {
  it('reads numeric text as a number', () => {
    expect(parseNumeric('150.00')).toBe(150);
    expect(parseNumeric('4.75')).toBe(4.75);
    expect(parseNumeric('-0.50')).toBe(-0.5);
  });

  it('leaves what is not a finite number alone', () => {
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric('NaN')).toBe('NaN');
    expect(parseNumeric(12)).toBe(12);
  });

  it('is the parser Sequelize uses for Postgres DECIMAL', () => {
    expect((DataTypes as any).postgres.DECIMAL.parse('99.90')).toBe(99.9);
  });
});
