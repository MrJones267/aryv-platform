/**
 * @fileoverview Model-derived schema builder for the ARYV TypeScript backend.
 *
 * Builds a complete, correct PostgreSQL schema from the Sequelize models without
 * relying on sequelize.sync(), whose index/FK generation is broken in this
 * codebase (index `fields` reference attribute names, not columns; partial-index
 * `where` clauses reference attributes; FK auto-indexes use attribute names).
 *
 * Strategy:
 *   1. Drop & recreate the public schema (+ required extensions).
 *   2. Create every table via queryInterface.createTable (no FK refs, so no
 *      ordering or auto-index issues), using the model's own column definitions.
 *   3. Add indexes + unique constraints from each model, resolving every field
 *      to its REAL column name via rawAttributes (handles arbitrary mappings
 *      like driverId -> user_id) and resolving partial-index where-clause keys.
 *   4. Add foreign keys from belongsTo associations, resolved the same way.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/build-schema.ts
 * Safe to re-run (drops and rebuilds). Intended for fresh databases only.
 *
 * @author Oabona-Majoko
 * @created 2026-06-20
 */

import { sequelize, testConnection } from '../src/models';

type AnyModel = any;

// Resolve a model attribute name to its actual DB column name.
const columnOf = (model: AnyModel, attr: string): string => {
  const a = model.rawAttributes?.[attr];
  return a ? (a.field || attr) : attr;
};

const result = { tables: 0, indexes: 0, uniques: 0, fks: 0, skipped: [] as string[] };

async function createTables(models: AnyModel[]): Promise<void> {
  const qi = sequelize.getQueryInterface();
  for (const model of models) {
    const attrs: Record<string, any> = {};
    for (const [k, v] of Object.entries(model.rawAttributes as Record<string, any>)) {
      attrs[k] = { ...v };
      // FK refs added separately (step 4) to avoid create-order/auto-index issues
      delete attrs[k].references;
      delete attrs[k].onDelete;
      delete attrs[k].onUpdate;
    }
    await qi.createTable(model.getTableName(), attrs);
    result.tables++;
  }
}

async function addIndexes(models: AnyModel[]): Promise<void> {
  const qi = sequelize.getQueryInterface();
  for (const model of models) {
    const table = model.getTableName();
    for (const idx of (model.options.indexes || []) as any[]) {
      const fields = (idx.fields || []).map((f: any) =>
        typeof f === 'string' ? columnOf(model, f)
          : (f && f.name ? { ...f, name: columnOf(model, f.name) } : f));
      const opts: any = { fields, unique: !!idx.unique };
      if (idx.name) opts.name = idx.name;
      if (idx.where && typeof idx.where === 'object') {
        const w: Record<string, any> = {};
        for (const [k, val] of Object.entries(idx.where)) w[columnOf(model, k)] = val;
        opts.where = w;
      }
      try {
        await qi.addIndex(table as any, opts);
        idx.unique ? result.uniques++ : result.indexes++;
      } catch (e: any) {
        result.skipped.push(`index ${String(table)}(${fields.join(',')}): ${e.message}`);
      }
    }
    // Note: single-column unique constraints (e.g. User.email) are created
    // inline by createTable from each attribute's `unique: true`. Composite
    // uniques come through options.indexes above. So nothing more to do here.
  }
}

async function addForeignKeys(models: AnyModel[]): Promise<void> {
  const qi = sequelize.getQueryInterface();
  for (const model of models) {
    const table = model.getTableName();
    for (const assoc of Object.values(model.associations || {}) as any[]) {
      if (assoc.associationType !== 'BelongsTo') continue;
      const fkCol = columnOf(model, assoc.foreignKey);
      const targetTable = assoc.target.getTableName();
      const targetCol = columnOf(assoc.target, assoc.targetKey || 'id');
      try {
        await qi.addConstraint(table as any, {
          type: 'foreign key',
          fields: [fkCol],
          references: { table: targetTable as any, field: targetCol },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
          name: `fk_${String(table)}_${fkCol}`,
        });
        result.fks++;
      } catch (e: any) {
        result.skipped.push(`fk ${String(table)}(${fkCol})->${String(targetTable)}: ${e.message}`);
      }
    }
  }
}

(async () => {
  try {
    await testConnection();
    await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    const models = Object.values(sequelize.models) as AnyModel[];
    await createTables(models);
    await addIndexes(models);
    await addForeignKeys(models);

    console.log(`SCHEMA_BUILD_OK tables=${result.tables} uniques=${result.uniques} indexes=${result.indexes} fks=${result.fks} skipped=${result.skipped.length}`);
    if (result.skipped.length) {
      console.log('--- skipped (review) ---');
      result.skipped.forEach((s) => console.log('  - ' + s));
    }
    await sequelize.close();
    process.exit(0);
  } catch (e: any) {
    console.error('SCHEMA_BUILD_FATAL:', e.message);
    process.exit(1);
  }
})();
