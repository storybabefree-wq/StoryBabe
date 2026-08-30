import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/storybabe.db');

const db = new DatabaseSync(dbPath);

console.log('Cleaning mock/demo users and test artifacts from database...');

db.exec(`
  DELETE FROM users WHERE email LIKE '%@storybabe.internal' OR email LIKE '%@internal.test' OR email LIKE '%@domain.com' OR email LIKE '%@example.com';
  DELETE FROM stories WHERE authorId LIKE 'user-elena%' OR authorId LIKE 'user-marcus%' OR authorId LIKE 'user-sarah%' OR authorId LIKE 'user-mod%';
  DELETE FROM episodes WHERE storyId IN ('story-1', 'story-2', 'story-3', 'story-4');
  DELETE FROM otp_verifications;
`);

const remainingUsers = db.prepare('SELECT id, email, username, displayName, emailVerified FROM users').all();
const remainingStories = db.prepare('SELECT count(*) as count FROM stories').get();

console.log('Clean-up complete.');
console.log('Remaining Users in DB:', remainingUsers);
console.log('Remaining Stories in DB:', remainingStories);
