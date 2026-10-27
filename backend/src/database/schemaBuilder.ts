/**
 * @fileoverview Builds the PostgreSQL schema from the Sequelize models.
 * @author Oabona-Majoko
 * @created 2026-06-20
 * @lastModified 2026-10-27
 *
 * sequelize.sync() cannot build this schema: index `fields` and partial-index
 * `where` clauses name model attributes rather than columns (driverId, whose
 * column is user_id; createdAt, whose column is created_at), so sync() emits
 * CREATE INDEX on columns that do not exist and stops at the first one. This
 * resolves every attribute to its real column through rawAttributes instead.
 *
 * Moved out of scripts/build-schema.ts so the integration tests can build
 * their database the same way production's was built, instead of calling the
 * sync() that has never worked here. The script now just calls this.
 *
 *   1. Create every table with its columns but no foreign keys, so creation
 *      order and FK auto-indexes do not matter.
 *   2. Add each model's indexes and composite uniques, columns resolved.
 *   3. Add a foreign key for every belongsTo association, columns resolved.
 *
 * It does not drop anything; callers that want a clean slate drop first.
 */

import type { Sequelize } from 'sequelize';

type AnyModel = any;

export interface SchemaBuildResult {
  tables: number;
  indexes: number;
  uniques: number;
  fks: number;
  /** Indexes or constraints that could not be created, with the reason. */
  skipped: string[];
}

/** Resolves a model attribute name to its actual database column name. */
const columnOf = (model: AnyModel, attr: string): string => {
  const a = model.rawAttributes?.[attr];
  return a ? a.field || attr : attr;
};

async function createTables(sequelize: Sequelize, models: AnyModel[], result: SchemaBuildResult): Promise<void> {
  const qi = sequelize.getQueryInterface();
  for (const model of models) {
    const attrs: Record<string, any> = {};
    for (const [k, v] of Object.entries(model.rawAttributes as Record<string, any>)) {
      attrs[k] = { ...v };
      // FK refs are added separately (step 3) to avoid create-order/auto-index issues
      delete attrs[k].references;
      delete attrs[k].onDelete;
      delete attrs[k].onUpdate;
    }
    await qi.createTable(model.getTableName(), attrs);
    result.tables++;
  }
}

async function addIndexes(sequelize: Sequelize, models: AnyModel[], result: SchemaBuildResult): Promise<void> {
  const qi = sequelize.getQueryInterface();
  for (const model of models) {
    const table = model.getTableName();
    for (const idx of (model.options.indexes || []) as any[]) {
      const fields = (idx.fields || []).map((f: any) =>
        typeof f === 'string' ? columnOf(model, f) : f && f.name ? { ...f, name: columnOf(model, f.name) } : f
      );
      const opts: any = { fields, unique: !!idx.unique };
      if (idx.name) opts.name = idx.name;
      if (idx.where && typeof idx.where === 'object') {
        const w: Record<string, any> = {};
        for (const [k, val] of Object.entries(idx.where)) w[columnOf(model, k)] = val;
        opts.where = w;
      }
      try {
        await qi.addIndex(table as any, opts);
        if (idx.unique) result.uniques++;
        else result.indexes++;
      } catch (e: any) {
        result.skipped.push(`index ${String(table)}(${fields.join(',')}): ${e.message}`);
      }
    }
    // Single-column unique constraints (e.g. User.email) are created inline by
    // createTable from each attribute's `unique: true`. Composite uniques come
    // through options.indexes above.
  }
}

async function addForeignKeys(sequelize: Sequelize, models: AnyModel[], result: SchemaBuildResult): Promise<void> {
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

/**
 * Creates every model's table, indexes and foreign keys in the connected
 * database. The models must already be registered on `sequelize`, which
 * importing `src/models` does.
 */
export async function buildSchemaFromModels(sequelize: Sequelize): Promise<SchemaBuildResult> {
  const result: SchemaBuildResult = { tables: 0, indexes: 0, uniques: 0, fks: 0, skipped: [] };
  const models = Object.values(sequelize.models) as AnyModel[];
  await createTables(sequelize, models, result);
  await addIndexes(sequelize, models, result);
  await addForeignKeys(sequelize, models, result);
  return result;
}

// Exports
export default buildSchemaFromModels;
