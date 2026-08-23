/**
 * @fileoverview Every attribute named in a query must exist on its model.
 * @author Oabona-Majoko
 * @created 2026-08-23
 * @lastModified 2026-08-23
 *
 * Thirty call sites across four controllers asked for `phoneNumber` and
 * `profileImage`. Those are the database *column* names; the model calls them
 * `phone` and `profilePicture`. Sequelize passes an unrecognised attribute
 * through to SQL verbatim, so the query selected a column named "phoneNumber"
 * — which does not exist, since the real one is phone_number — and every
 * endpoint that used them failed.
 *
 * Verified before fixing, by capturing the SQL of a real findAll:
 *
 *   bad:  SELECT "id", "first_name" AS "firstName", "phoneNumber", "profileImage" ...
 *   good: SELECT "id", "first_name" AS "firstName", "phone_number" AS "phone", ...
 *
 * TypeScript cannot catch this: attribute lists are plain string arrays.
 */

import fs from 'fs';
import path from 'path';
import { User } from '../../models';

const CONTROLLERS = path.resolve(__dirname, '../../controllers');

/** Attribute names Sequelize will accept for User. */
const userAttributes = new Set(Object.keys((User as any).rawAttributes));

/**
 * Column names that are easy to reach for by mistake, because they are what
 * the database calls these fields.
 */
const COLUMN_NAMES_MISTAKEN_FOR_ATTRIBUTES = [
  'phoneNumber',
  'profileImage',
  'phone_number',
  'profile_image',
  'first_name',
  'last_name',
  'password_hash',
];

const readControllers = (): Array<{ file: string; source: string }> =>
  fs
    .readdirSync(CONTROLLERS)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, source: fs.readFileSync(path.join(CONTROLLERS, f), 'utf8') }));

describe('model attribute names used in queries', () => {
  const controllers = readControllers();

  it('has controllers to inspect', () => {
    expect(controllers.length).toBeGreaterThan(10);
  });

  it('never asks for a column name where an attribute name is required', () => {
    const offenders: string[] = [];

    for (const { file, source } of controllers) {
      source.split('\n').forEach((line, index) => {
        // Only attribute lists — the strings Sequelize resolves against a model.
        if (!line.includes('attributes')) return;

        for (const name of COLUMN_NAMES_MISTAKEN_FOR_ATTRIBUTES) {
          if (line.includes(`'${name}'`) || line.includes(`"${name}"`)) {
            offenders.push(`${file}:${index + 1} uses '${name}'`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it('knows what the real User attributes are, so this test cannot go stale', () => {
    // If the model is renamed, these fail and the list above needs revisiting.
    expect(userAttributes.has('phone')).toBe(true);
    expect(userAttributes.has('profilePicture')).toBe(true);
    expect(userAttributes.has('phoneNumber')).toBe(false);
    expect(userAttributes.has('profileImage')).toBe(false);
  });
});
