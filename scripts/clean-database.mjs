import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

if (fs.existsSync('StoryBabe.env')) {
  dotenv.config({ path: 'StoryBabe.env' });
} else {
  dotenv.config();
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Cleaning mock/demo users and test artifacts from Supabase PostgreSQL...');

async function main() {
  await pool.query(`
    DELETE FROM users WHERE email LIKE '%@storybabe.internal' OR email LIKE '%@internal.test' OR email LIKE '%@domain.com' OR email LIKE '%@example.com';
    DELETE FROM stories WHERE "authorId" LIKE 'user-elena%' OR "authorId" LIKE 'user-marcus%' OR "authorId" LIKE 'user-sarah%' OR "authorId" LIKE 'user-mod%';
    DELETE FROM episodes WHERE "storyId" IN ('story-1', 'story-2', 'story-3', 'story-4');
    DELETE FROM otp_verifications;
  `);

  const remainingUsers = await pool.query('SELECT id, email, username, "displayName", "emailVerified" FROM users');
  const remainingStories = await pool.query('SELECT count(*) as count FROM stories');

  console.log('Clean-up complete.');
  console.log('Remaining Users in DB:', remainingUsers.rows);
  console.log('Remaining Stories in DB:', remainingStories.rows[0]?.count || 0);
  await pool.end();
}

main().catch((err) => {
  console.error('Clean-up failed:', err);
  process.exit(1);
});

