import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates the first moderator account so someone can log in and start
 * registering everyone else, and marks it protected (see UpdateUserUseCase) so nobody can
 * deactivate it, reset its password, or edit its data through the API. Safe to re-run — it's a
 * no-op beyond re-confirming that protection if the account already exists.
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
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      // Re-running the seed (deploy.sh does this on every deploy) is also how a database seeded
      // before is_protected existed picks it up — this UPDATE is idempotent and harmless once
      // the account is already protected.
      await pool.query('UPDATE users SET is_protected = TRUE WHERE id = $1', [existing.rows[0].id]);
      console.log(`Seed: moderator "${username}" already exists — confirmed protected, skipping creation.`);
      return;
    }

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      `INSERT INTO users (full_name, username, password_hash, role, must_change_password, is_protected)
       VALUES ($1, $2, $3, 'MODERATOR', TRUE, TRUE)`,
      [fullName, username, passwordHash],
    );

    console.log('Seed: created first moderator account:');
    console.log(`  username: ${username}`);
    console.log(`  temporary password: ${tempPassword}`);
    console.log('  (they will be forced to set a new password on first login)');
    console.log('  This account is protected: it cannot be deactivated, reset, or edited by anyone.');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
