import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates the first moderator account so someone can log in and start
 * registering everyone else. Safe to re-run — it's a no-op if the account
 * already exists.
 *
 * Configure via env vars, or fall back to the printed defaults below
 * (mustChangePassword is always true, so they set their own password on first login regardless).
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  const username = process.env.SEED_MODERATOR_USERNAME ?? 'admin';
  const fullName = process.env.SEED_MODERATOR_NAME ?? 'Joi Admin';
  const tempPassword = process.env.SEED_MODERATOR_PASSWORD ?? 'ChangeMe123';

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      console.log(`Seed: moderator "${username}" already exists — skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (full_name, username, password_hash, role, must_change_password)
       VALUES ($1, $2, $3, 'MODERATOR', TRUE)`,
      [fullName, username, passwordHash],
    );

    console.log('Seed: created first moderator account:');
    console.log(`  username: ${username}`);
    console.log(`  temporary password: ${tempPassword}`);
    console.log('  (they will be forced to set a new password on first login)');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
