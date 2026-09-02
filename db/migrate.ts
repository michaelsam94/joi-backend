import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/** Applies db/schema.sql against DATABASE_URL. Idempotent — every statement is IF NOT EXISTS. */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(sql);
    console.log('✅ Schema applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
