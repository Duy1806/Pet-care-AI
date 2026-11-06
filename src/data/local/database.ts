/**
 * PawCare AI — Local SQLite Database Initialization & Migrations
 *
 * Implements PRAGMA user_version schema versioning.
 * Creates local mirror tables with sync_status tracking and sync_outbox.
 */
import * as SQLite from 'expo-sqlite';

export const DB_NAME = 'pawcare.db';
export const CURRENT_DB_VERSION = 1;

/**
 * Migration scripts keyed by version number.
 */
const MIGRATIONS: Record<number, string> = {
  1: `
    -- 1. Sync State (tracking last pulled timestamps per table)
    CREATE TABLE IF NOT EXISTS sync_state (
      entity_table TEXT PRIMARY KEY,
      last_pulled_at TEXT
    );

    -- 2. Sync Outbox (FIFO queue for local offline changes)
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity_table TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON sync_outbox(created_at);

    -- 3. Cached Breeds (Reference)
    CREATE TABLE IF NOT EXISTS breeds (
      id TEXT PRIMARY KEY,
      species TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_vi TEXT NOT NULL,
      size_category TEXT,
      typical_weight_min_kg REAL,
      typical_weight_max_kg REAL,
      description TEXT,
      common_health_issues TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    -- 4. Pets (Mirror)
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed_id TEXT,
      breed_name_custom TEXT,
      sex TEXT,
      is_neutered INTEGER NOT NULL DEFAULT 0,
      birth_date TEXT,
      current_weight_kg REAL,
      activity_level TEXT NOT NULL DEFAULT 'moderate',
      photo_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'conflict')),
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_pets_owner ON pets(owner_id);
    CREATE INDEX IF NOT EXISTS idx_local_pets_sync ON pets(sync_status);

    -- 5. Weight Logs (Mirror)
    CREATE TABLE IF NOT EXISTS weight_logs (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      measured_at TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'conflict')),
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_weight_pet ON weight_logs(pet_id);

    -- 6. Health Logs (Mirror)
    CREATE TABLE IF NOT EXISTS health_logs (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      logged_at TEXT NOT NULL,
      attachments TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_local_health_pet ON health_logs(pet_id);

    -- 7. Vaccinations (Mirror)
    CREATE TABLE IF NOT EXISTS vaccinations (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      administered_at TEXT NOT NULL,
      next_due_at TEXT,
      vet_clinic TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    -- 8. Reminders (Mirror)
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      repeat_rule TEXT NOT NULL DEFAULT 'none',
      is_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    -- 9. Nutrition Plans (Mirror)
    CREATE TABLE IF NOT EXISTS nutrition_plans (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      weight_kg_at_calc REAL NOT NULL,
      rer_kcal REAL NOT NULL,
      activity_factor REAL NOT NULL,
      mer_kcal REAL NOT NULL,
      meals_per_day INTEGER NOT NULL DEFAULT 2,
      recommendation_text TEXT,
      llm_model TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    -- 10. Breed Predictions (Mirror)
    CREATE TABLE IF NOT EXISTS breed_predictions (
      id TEXT PRIMARY KEY,
      pet_id TEXT,
      owner_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      top_breed_id TEXT,
      top_confidence REAL NOT NULL,
      alternatives TEXT NOT NULL,
      model_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL
    );

    -- 11. Blog Categories (Local Cache)
    CREATE TABLE IF NOT EXISTS blog_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0
    );

    -- 12. Articles (Local Cache)
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      author_id TEXT,
      category_id TEXT,
      category_name TEXT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      cover_image_url TEXT,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      target_species TEXT NOT NULL DEFAULT 'all',
      source_url TEXT,
      source_name TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      views_count INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      last_synced_at TEXT,
      local_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_local_articles_species ON articles(target_species);
    CREATE INDEX IF NOT EXISTS idx_local_articles_cat ON articles(category_id);
  `,
};

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Get or initialize the SQLite database connection.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Read current schema version
  const versionResult = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < CURRENT_DB_VERSION) {
    // Run incremental migrations
    for (let v = currentVersion + 1; v <= CURRENT_DB_VERSION; v++) {
      const sql = MIGRATIONS[v];
      if (sql) {
        await db.execAsync(sql);
      }
    }
    await db.execAsync(`PRAGMA user_version = ${CURRENT_DB_VERSION};`);
  }

  // Ensure missing columns in existing local SQLite tables
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(articles);');
    const existingCols = new Set(tableInfo.map((c) => c.name));

    const requiredCols: Array<{ name: string; type: string }> = [
      { name: 'deleted_at', type: 'TEXT' },
      { name: 'sync_status', type: "TEXT NOT NULL DEFAULT 'synced'" },
      { name: 'last_synced_at', type: 'TEXT' },
      { name: 'local_updated_at', type: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' },
      { name: 'category_name', type: 'TEXT' },
    ];

    for (const col of requiredCols) {
      if (!existingCols.has(col.name)) {
        await db.execAsync(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type};`);
      }
    }
  } catch (e) {
    console.warn('[Database] articles column migration warning:', e);
  }

  dbInstance = db;
  return db;
}

