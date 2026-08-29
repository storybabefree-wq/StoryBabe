import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type {
  UserProfile,
  AuthUser,
  Story,
  Episode,
  Comment,
  SafetyFlag,
  StoryType,
  StoryStatus,
  EpisodeStatus,
  UserRole
} from '@storybabe/types';

// Ensure database directory exists within the workspace
const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'storybabe.db');

export const db = new DatabaseSync(dbPath);

// Initialize schema tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    bio TEXT,
    avatarUrl TEXT,
    role TEXT DEFAULT 'AUTHOR',
    lastUsernameChangeAt TEXT,
    usernameChangesCount INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS username_history (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    oldUsername TEXT NOT NULL,
    newUsername TEXT NOT NULL,
    changedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    authorId TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    oneliner TEXT,
    posterUrl TEXT,
    posterStyle TEXT DEFAULT 'bottom-gradient',
    posterType TEXT DEFAULT 'PRESET',
    content TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'ONGOING',
    onHoldReason TEXT,
    isInactive INTEGER DEFAULT 0,
    inactiveTaggedAt TEXT,
    allowComments INTEGER DEFAULT 1,
    viewsCount INTEGER DEFAULT 0,
    likesCount INTEGER DEFAULT 0,
    isUnpublished INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    publishedAt TEXT,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Safe migrations for existing SQLite database using PRAGMA table_info
try {
  const tableInfo = db.prepare("PRAGMA table_info(stories)").all() as any[];
  const cols = new Set(tableInfo.map((c) => c.name));
  if (!cols.has('oneliner')) {
    db.exec('ALTER TABLE stories ADD COLUMN oneliner TEXT');
  }
  if (!cols.has('posterUrl')) {
    db.exec('ALTER TABLE stories ADD COLUMN posterUrl TEXT');
  }
  if (!cols.has('posterStyle')) {
    db.exec("ALTER TABLE stories ADD COLUMN posterStyle TEXT DEFAULT 'bottom-gradient'");
  }
  if (!cols.has('posterType')) {
    db.exec("ALTER TABLE stories ADD COLUMN posterType TEXT DEFAULT 'PRESET'");
  }
} catch (e) {
  console.error('Migration error:', e);
}

// Update existing seeded stories with rich visual posters & oneliners if null
try {
  db.prepare(`
    UPDATE stories SET
      oneliner = CASE
        WHEN id = 'story-1' THEN 'Some memories are too heavy to fold away.'
        WHEN id = 'story-2' THEN 'At 4:00 AM in corporate finance, they called the trembling in my fingers hunger.'
        WHEN id = 'story-3' THEN 'I realized I had become a background prop in a life we were supposed to build.'
        WHEN id = 'story-4' THEN 'Leaving pediatric care felt like taking off a coat of armor.'
        ELSE COALESCE(oneliner, title)
      END,
      posterUrl = CASE
        WHEN id = 'story-1' THEN 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80'
        WHEN id = 'story-2' THEN 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1000&q=80'
        WHEN id = 'story-3' THEN 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80'
        WHEN id = 'story-4' THEN 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1000&q=80'
        ELSE COALESCE(posterUrl, 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80')
      END,
      posterStyle = COALESCE(posterStyle, 'bottom-gradient'),
      posterType = COALESCE(posterType, 'PRESET')
    WHERE posterUrl IS NULL OR oneliner IS NULL;
  `).run();
} catch (e) {
  console.error('Update seed posters error:', e);
}

db.exec(`

  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    storyId TEXT NOT NULL,
    seasonNumber INTEGER DEFAULT 1,
    episodeNumber INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'COMPLETED',
    onHoldReason TEXT,
    viewsCount INTEGER DEFAULT 0,
    likesCount INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    UNIQUE(storyId, seasonNumber, episodeNumber)
  );

  CREATE TABLE IF NOT EXISTS story_safety_flags (
    id TEXT PRIMARY KEY,
    storyId TEXT NOT NULL,
    flag TEXT NOT NULL,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    UNIQUE(storyId, flag)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS story_tags (
    id TEXT PRIMARY KEY,
    storyId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(storyId, tagId)
  );

  CREATE TABLE IF NOT EXISTS story_likes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    storyId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    UNIQUE(userId, storyId)
  );

  CREATE TABLE IF NOT EXISTS episode_likes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    episodeId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (episodeId) REFERENCES episodes(id) ON DELETE CASCADE,
    UNIQUE(userId, episodeId)
  );

  CREATE TABLE IF NOT EXISTS story_views (
    id TEXT PRIMARY KEY,
    userId TEXT,
    storyId TEXT NOT NULL,
    ipAddress TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episode_views (
    id TEXT PRIMARY KEY,
    userId TEXT,
    episodeId TEXT NOT NULL,
    ipAddress TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (episodeId) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    storyId TEXT NOT NULL,
    episodeId TEXT,
    userId TEXT NOT NULL,
    parentId TEXT,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    commentId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE,
    UNIQUE(userId, commentId)
  );

  CREATE TABLE IF NOT EXISTS follows (
    id TEXT PRIMARY KEY,
    followerId TEXT NOT NULL,
    followingId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (followerId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(followerId, followingId)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    storyId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE,
    UNIQUE(userId, storyId)
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporterId TEXT NOT NULL,
    storyId TEXT NOT NULL,
    episodeId TEXT,
    category TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL',
    status TEXT DEFAULT 'PENDING',
    reason TEXT NOT NULL,
    moderatorNotes TEXT,
    resolvedById TEXT,
    resolvedAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (reporterId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (storyId) REFERENCES stories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS moderation_actions (
    id TEXT PRIMARY KEY,
    reportId TEXT,
    moderatorId TEXT NOT NULL,
    actionType TEXT NOT NULL,
    targetType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    notes TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (moderatorId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Auto-seed if users table is empty or ensure admin exists
const modExists = db.prepare("SELECT id FROM users WHERE username = 'storybabe_mod'").get();
if (!modExists) {
  const hash = bcrypt.hashSync('password123', 10);
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, username, displayName, passwordHash, bio, role, lastUsernameChangeAt, usernameChangesCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'user-mod-admin-4',
    'mod@storybabe.internal',
    'storybabe_mod',
    'StoryBabe Safety Desk',
    hash,
    'Community safety and prioritized report review desk.',
    'ADMIN',
    null,
    0,
    nowIso,
    nowIso
  );
}

const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
const { count: initialUserCount } = userCountStmt.get() as any;

if (initialUserCount <= 1) {
  const hash = bcrypt.hashSync('password123', 10);
  const now = new Date();
  const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  // Users
  const uElena = {
    id: 'user-elena-vance-1',
    email: 'elena@storybabe.internal',
    username: 'elena_v',
    displayName: 'Elena Vance',
    passwordHash: hash,
    bio: 'Writing through transitions. Former pediatric ICU nurse living in Chicago.',
    role: 'AUTHOR',
    lastUsernameChangeAt: thirtyFiveDaysAgo,
    usernameChangesCount: 1,
    createdAt: thirtyFiveDaysAgo,
    updatedAt: nowIso
  };

  const uMarcus = {
    id: 'user-marcus-thorne-2',
    email: 'marcus@storybabe.internal',
    username: 'marcus_k',
    displayName: 'Marcus Thorne',
    passwordHash: hash,
    bio: 'Rebuilding after 12 years in corporate finance. Honest reflections on family, addiction, and starting from scratch.',
    role: 'AUTHOR',
    lastUsernameChangeAt: fiveDaysAgo,
    usernameChangesCount: 1,
    createdAt: fiveDaysAgo,
    updatedAt: nowIso
  };

  const uSarah = {
    id: 'user-sarah-chen-3',
    email: 'sarah@storybabe.internal',
    username: 'sarah_solitude',
    displayName: 'Sarah Chen',
    passwordHash: hash,
    bio: 'Lover of coastal rain and quiet realizations. Documenting what we never say out loud.',
    role: 'AUTHOR',
    lastUsernameChangeAt: null,
    usernameChangesCount: 0,
    createdAt: thirtyFiveDaysAgo,
    updatedAt: nowIso
  };

  const uMod = {
    id: 'user-mod-admin-4',
    email: 'mod@storybabe.internal',
    username: 'storybabe_mod',
    displayName: 'StoryBabe Safety Desk',
    passwordHash: hash,
    bio: 'Community safety and prioritized report review desk.',
    role: 'ADMIN',
    lastUsernameChangeAt: null,
    usernameChangesCount: 0,
    createdAt: thirtyFiveDaysAgo,
    updatedAt: nowIso
  };

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, username, displayName, passwordHash, bio, role, lastUsernameChangeAt, usernameChangesCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(uElena.id, uElena.email, uElena.username, uElena.displayName, uElena.passwordHash, uElena.bio, uElena.role, uElena.lastUsernameChangeAt, uElena.usernameChangesCount, uElena.createdAt, uElena.updatedAt);
  insertUser.run(uMarcus.id, uMarcus.email, uMarcus.username, uMarcus.displayName, uMarcus.passwordHash, uMarcus.bio, uMarcus.role, uMarcus.lastUsernameChangeAt, uMarcus.usernameChangesCount, uMarcus.createdAt, uMarcus.updatedAt);
  insertUser.run(uSarah.id, uSarah.email, uSarah.username, uSarah.displayName, uSarah.passwordHash, uSarah.bio, uSarah.role, uSarah.lastUsernameChangeAt, uSarah.usernameChangesCount, uSarah.createdAt, uSarah.updatedAt);
  insertUser.run(uMod.id, uMod.email, uMod.username, uMod.displayName, uMod.passwordHash, uMod.bio, uMod.role, uMod.lastUsernameChangeAt, uMod.usernameChangesCount, uMod.createdAt, uMod.updatedAt);

  // Follows
  const insertFollow = db.prepare('INSERT INTO follows (id, followerId, followingId, createdAt) VALUES (?, ?, ?, ?)');
  insertFollow.run('f-1', uSarah.id, uElena.id, nowIso);
  insertFollow.run('f-2', uMarcus.id, uElena.id, nowIso);
  insertFollow.run('f-3', uElena.id, uMarcus.id, nowIso);

  // Tags
  const insertTag = db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)');
  insertTag.run('tag-1', 'grief');
  insertTag.run('tag-2', 'family');
  insertTag.run('tag-3', 'recovery');
  insertTag.run('tag-4', 'career');
  insertTag.run('tag-5', 'growth');
  insertTag.run('tag-6', '3am thoughts');
  insertTag.run('tag-7', 'breakup');

  // Stories
  const insertStory = db.prepare(`
    INSERT INTO stories (id, authorId, title, summary, content, type, status, onHoldReason, isInactive, inactiveTaggedAt, allowComments, viewsCount, likesCount, createdAt, updatedAt, publishedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Story 1: Single, Completed, Grief/Death Loss
  const s1Date = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  insertStory.run(
    'story-1',
    uElena.id,
    'The Blue Wool Coat in the Closet',
    'Three years after my mother passed away, I finally went through the winter wardrobe. Some items hold memories you cannot fold away.',
    `The coat still carried the faint scent of cedar chips and peppermint lozenges.

For thirty-six months, that blue wool coat hung on the third wooden hanger from the left in the guest hallway closet. Whenever visitors came over, I would deliberately steer them away from that closet. It was not about preservation in a museum sense. It was simpler and heavier: if I touched it, I would have to acknowledge that the person who wore it was truly gone.

My mother bought that coat in the winter of 1998 during a freezing weekend in Boston. She had saved for three months to buy something that felt dignified. Whenever she wore it, she walked with an uprightness she didn't possess on ordinary weekday mornings.

Last Tuesday, during an unexpected thunderstorm that knocked out the power on our block, I sat on the floor of the hallway with a flashlight. I didn't cry immediately. I just put my hand in the left pocket and found an unopened peppermint lozenge and a transit receipt dated November 14, 2021.

Grief doesn't come in waves like people say. It sits quietly like an old winter coat, waiting for you to open the door.`,
    'SINGLE',
    'COMPLETED',
    null,
    0,
    null,
    1,
    342,
    58,
    s1Date,
    s1Date,
    s1Date
  );

  // Safety Flags & Story Tags for Story 1
  const insertFlag = db.prepare('INSERT INTO story_safety_flags (id, storyId, flag) VALUES (?, ?, ?)');
  insertFlag.run('sf-1', 'story-1', 'DEATH_LOSS');

  const insertStoryTag = db.prepare('INSERT INTO story_tags (id, storyId, tagId) VALUES (?, ?, ?)');
  insertStoryTag.run('st-1', 'story-1', 'tag-1');
  insertStoryTag.run('st-2', 'story-1', 'tag-2');

  // Story 2: Series, Ongoing, Substance Use & Mental Health
  const s2Date = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
  insertStory.run(
    'story-2',
    uMarcus.id,
    'Twelve Steps Away From the Boardroom',
    'A multi-part account of walking away from a high-paying finance partnership to enter rehab in rural Michigan.',
    null,
    'SERIES',
    'ONGOING',
    null,
    0,
    null,
    1,
    890,
    142,
    s2Date,
    s2Date,
    s2Date
  );

  insertFlag.run('sf-2', 'story-2', 'SUBSTANCE_USE');
  insertFlag.run('sf-3', 'story-2', 'MENTAL_HEALTH_CRISIS');
  insertStoryTag.run('st-3', 'story-2', 'tag-3');
  insertStoryTag.run('st-4', 'story-2', 'tag-4');
  insertStoryTag.run('st-5', 'story-2', 'tag-5');

  // Episodes for Story 2
  const insertEp = db.prepare(`
    INSERT INTO episodes (id, storyId, seasonNumber, episodeNumber, title, content, status, viewsCount, likesCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEp.run(
    'ep-1',
    'story-2',
    1,
    1,
    'The 4:00 AM Spreadsheet',
    `The glass conference table reflected three empty espresso cups and a prescription bottle I had hidden beneath a stack of quarterly forecasts.

In financial firms, no one questions why you are still at your desk at 4:00 AM. They call it 'hunger.' They call it 'dedication.' What they don't see is the trembling in your fingers that only stops when you take another tablet with lukewarm tap water from the hallway sink.

That morning was different because the numbers on page 42 finally stopped making sense. Not mathematically—mathematically they were flawless. But my brain kept asking: 'Who are you doing this for?' My partner was sleeping in a separate bedroom at home. My father hadn't received a call from me in four months. And my reflection in the dark high-rise window looked like a stranger who had stolen my suit.`,
    'COMPLETED',
    512,
    84,
    s2Date,
    s2Date
  );

  const s2Ep2Date = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  insertEp.run(
    'ep-2',
    'story-2',
    1,
    2,
    'Surrendering the Keys',
    `The intake nurse in Michigan asked for my belt, my shoelaces, and my company phone.

Handing over the phone was harder than handing over the keys to my car. For ten years, that device had buzzed every twelve seconds with notifications, market updates, and urgent requests that convinced me I was indispensable.

When the nurse placed it inside a clear plastic evidence bag and locked it inside a steel filing cabinet, the silence was physically deafening. I spent the first thirty-six hours pacing the perimeter of the gravel courtyard, counting pinecones just to give my hands something to focus on.`,
    'COMPLETED',
    378,
    58,
    s2Ep2Date,
    s2Ep2Date
  );

  // Story 3: Series, On Hold with Reason
  const s3Date = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
  insertStory.run(
    'story-3',
    uSarah.id,
    'Letters I Wrote But Never Mailed',
    'Unsent drafts to former roommates, estrangements, and old friends across five cities.',
    null,
    'SERIES',
    'ON_HOLD',
    'Taking a 2-week pause while moving into a new apartment in Seattle.',
    0,
    null,
    1,
    420,
    76,
    s3Date,
    s3Date,
    s3Date
  );

  insertStoryTag.run('st-6', 'story-3', 'tag-6');
  insertStoryTag.run('st-7', 'story-3', 'tag-7');

  insertEp.run(
    'ep-3',
    'story-3',
    1,
    1,
    'To Maya: 4th Floor Walkup on 8th Street',
    `Dear Maya,

We spent twenty-two months sharing a refrigerator where neither of us drank the oat milk before it went sour. We used to leave Post-it notes on the bathroom mirror: 'Don't forget your umbrella' or 'Leftover pad thai is yours.'

I never told you why I left so abruptly in June. It wasn't about the rent increase or the broken radiator. It was because one evening, listening to you laugh with your new coworker in the kitchen, I realized I had become a background prop in a life we were supposed to build together.`,
    'COMPLETED',
    420,
    76,
    s3Date,
    s3Date
  );

  // Story 4: Series, Inactive (75 days old)
  const s4Date = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString();
  insertStory.run(
    'story-4',
    uSarah.id,
    'The Year of Solo Dinners in Kyoto',
    'Living alone in an 18-mat apartment above an alleyway noodle shop in Kansai.',
    null,
    'SERIES',
    'ONGOING',
    null,
    1,
    new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    1,
    610,
    95,
    s4Date,
    s4Date,
    s4Date
  );

  insertStoryTag.run('st-8', 'story-4', 'tag-5');

  insertEp.run(
    'ep-4',
    'story-4',
    1,
    1,
    'Ordering in Broken Syllables',
    `The old cook behind the counter didn't look up when the wooden sliding door clicked open. He just placed a cup of roasted barley tea on the counter and pointed to the laminated picture menu.

That first week, my entire vocabulary consisted of four polite phrases. When you don't speak the language of the city you sleep in, your hearing becomes acutely sharp. You notice the cadence of rain against corrugated tin roofs and the exact rhythm of temple bells at dawn.`,
    'COMPLETED',
    610,
    95,
    s4Date,
    s4Date
  );

  // Comments
  const insertComment = db.prepare(`
    INSERT INTO comments (id, storyId, episodeId, userId, parentId, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertComment.run(
    'c-1',
    'story-1',
    null,
    uMarcus.id,
    null,
    'This made me tear up at my desk. My grandmother kept her gardening gloves in the mudroom for four years after she was gone. Thank you for putting this feeling into words.',
    s1Date,
    s1Date
  );

  insertComment.run(
    'c-2',
    'story-1',
    null,
    uElena.id,
    'c-1',
    'Thank you Marcus. It is strange how everyday objects become holy relics when the person who held them is no longer here.',
    s1Date,
    s1Date
  );

  // Likes & Views
  const insertStoryLike = db.prepare('INSERT INTO story_likes (id, userId, storyId, createdAt) VALUES (?, ?, ?, ?)');
  insertStoryLike.run('sl-1', uMarcus.id, 'story-1', nowIso);
  insertStoryLike.run('sl-2', uSarah.id, 'story-1', nowIso);
  insertStoryLike.run('sl-3', uElena.id, 'story-2', nowIso);

  // Reports (1 High Priority NO_CONSENT report, 1 standard report)
  const insertReport = db.prepare(`
    INSERT INTO reports (id, reporterId, storyId, episodeId, category, priority, status, reason, moderatorNotes, resolvedById, resolvedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReport.run(
    'rep-1',
    uSarah.id,
    'story-2',
    'ep-1',
    'NO_CONSENT',
    'HIGH',
    'PENDING',
    'A former colleague believes Episode 1 describes specific closed-door deal terms and private conversations without consent.',
    null,
    null,
    null,
    nowIso,
    nowIso
  );

  insertReport.run(
    'rep-2',
    uElena.id,
    'story-3',
    null,
    'OTHER',
    'NORMAL',
    'PENDING',
    'General question about mobile layout formatting in the reader.',
    null,
    null,
    null,
    nowIso,
    nowIso
  );
}

// -------------------------------------------------------------
// Type-safe Prisma-like Database abstraction
// -------------------------------------------------------------

export const prisma = {
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    db.exec('BEGIN TRANSACTION');
    try {
      const res = await fn(prisma);
      db.exec('COMMIT');
      return res;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string; username?: string } }) => {
      let row: any = null;
      if (where.id) {
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(where.id);
      } else if (where.email) {
        row = db.prepare('SELECT * FROM users WHERE email = ?').get(where.email.toLowerCase());
      } else if (where.username) {
        row = db.prepare('SELECT * FROM users WHERE username = ?').get(where.username.toLowerCase());
      }
      if (!row) return null;

      const followersCount = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE followingId = ?').get(row.id) as any).c;
      const followingCount = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE followerId = ?').get(row.id) as any).c;
      const storiesCount = (db.prepare('SELECT COUNT(*) as c FROM stories WHERE authorId = ? AND isUnpublished = 0').get(row.id) as any).c;

      return {
        ...row,
        _count: {
          followers: followersCount,
          following: followingCount,
          stories: storiesCount
        }
      };
    },

    findFirst: async ({ where }: { where: { OR?: Array<{ email?: string; username?: string }> } }) => {
      if (where.OR && where.OR.length > 0) {
        for (const item of where.OR) {
          if (item.email) {
            const res = await prisma.user.findUnique({ where: { email: item.email } });
            if (res) return res;
          }
          if (item.username) {
            const res = await prisma.user.findUnique({ where: { username: item.username } });
            if (res) return res;
          }
        }
      }
      return null;
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, email, username, displayName, passwordHash, bio, avatarUrl, role, lastUsernameChangeAt, usernameChangesCount, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.email.toLowerCase(),
        data.username.toLowerCase(),
        data.displayName,
        data.passwordHash,
        data.bio || null,
        data.avatarUrl || null,
        data.role || 'AUTHOR',
        data.lastUsernameChangeAt || null,
        data.usernameChangesCount || 0,
        now,
        now
      );
      return prisma.user.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = db.prepare('SELECT * FROM users WHERE id = ?').get(where.id) as any;
      if (!current) throw new Error('User not found');

      const now = new Date().toISOString();
      const newUsername = data.username !== undefined ? data.username.toLowerCase() : current.username;
      const newDisplayName = data.displayName !== undefined ? data.displayName : current.displayName;
      const newBio = data.bio !== undefined ? data.bio : current.bio;
      const newAvatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : current.avatarUrl;
      const newLastChange = data.lastUsernameChangeAt !== undefined ? (data.lastUsernameChangeAt ? new Date(data.lastUsernameChangeAt).toISOString() : null) : current.lastUsernameChangeAt;
      const newChangeCount = data.usernameChangesCount?.increment !== undefined ? current.usernameChangesCount + 1 : (data.usernameChangesCount !== undefined ? data.usernameChangesCount : current.usernameChangesCount);

      db.prepare(`
        UPDATE users SET username = ?, displayName = ?, bio = ?, avatarUrl = ?, lastUsernameChangeAt = ?, usernameChangesCount = ?, updatedAt = ?
        WHERE id = ?
      `).run(newUsername, newDisplayName, newBio, newAvatarUrl, newLastChange, newChangeCount, now, where.id);

      return prisma.user.findUnique({ where: { id: where.id } });
    },

    count: async ({ where }: { where?: any } = {}) => {
      const res = db.prepare('SELECT COUNT(*) as c FROM users').get() as any;
      return res.c;
    }
  },

  usernameHistory: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO username_history (id, userId, oldUsername, newUsername, changedAt) VALUES (?, ?, ?, ?, ?)').run(
        id,
        data.userId,
        data.oldUsername,
        data.newUsername,
        now
      );
    }
  },

  story: {
    findMany: async ({ where = {}, orderBy = {}, skip = 0, take = 20 }: any = {}) => {
      let query = 'SELECT s.* FROM stories s WHERE s.isUnpublished = 0';
      const params: any[] = [];

      if (where.type) {
        query += ' AND s.type = ?';
        params.push(where.type);
      }
      if (where.status) {
        query += ' AND s.status = ?';
        params.push(where.status);
      }
      if (where.authorId) {
        if (typeof where.authorId === 'string') {
          query += ' AND s.authorId = ?';
          params.push(where.authorId);
        } else if (where.authorId.in && Array.isArray(where.authorId.in)) {
          if (where.authorId.in.length === 0) return [];
          const placeholders = where.authorId.in.map(() => '?').join(',');
          query += ` AND s.authorId IN (${placeholders})`;
          params.push(...where.authorId.in);
        }
      }
      if (where.isInactive !== undefined) {
        query += ' AND s.isInactive = ?';
        params.push(where.isInactive ? 1 : 0);
      }

      if (where.tag || (where.tags && where.tags.some)) {
        const tagToMatch = where.tag || where.tags.some.tag.name.equals;
        query += ' AND s.id IN (SELECT st.storyId FROM story_tags st JOIN tags t ON st.tagId = t.id WHERE t.name = ?)';
        params.push(tagToMatch.toLowerCase());
      }

      if (where.safetyFlag || (where.safetyFlags && where.safetyFlags.some)) {
        const flagToMatch = where.safetyFlag || where.safetyFlags.some.flag;
        query += ' AND s.id IN (SELECT ssf.storyId FROM story_safety_flags ssf WHERE ssf.flag = ?)';
        params.push(flagToMatch);
      }

      if (where.OR) {
        const searchVal = where.OR[0]?.title?.contains || '';
        if (searchVal) {
          query += ' AND (s.title LIKE ? OR s.summary LIKE ? OR s.content LIKE ?)';
          const likePattern = `%${searchVal}%`;
          params.push(likePattern, likePattern, likePattern);
        }
      }

      query += ' ORDER BY s.createdAt DESC';
      query += ` LIMIT ${take} OFFSET ${skip}`;

      const rows = db.prepare(query).all(...params) as any[];
      return Promise.all(rows.map((row) => prisma.story.findUnique({ where: { id: row.id } })));
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(where.id) as any;
      if (!row) return null;

      const author = await prisma.user.findUnique({ where: { id: row.authorId } });
      const flags = db.prepare('SELECT flag FROM story_safety_flags WHERE storyId = ?').all(row.id) as any[];
      const tags = db.prepare('SELECT t.name FROM story_tags st JOIN tags t ON st.tagId = t.id WHERE st.storyId = ?').all(row.id) as any[];
      const episodes = db.prepare('SELECT * FROM episodes WHERE storyId = ? ORDER BY seasonNumber ASC, episodeNumber ASC').all(row.id) as any[];
      const likes = db.prepare('SELECT userId FROM story_likes WHERE storyId = ?').all(row.id) as any[];
      const bookmarks = db.prepare('SELECT userId FROM bookmarks WHERE storyId = ?').all(row.id) as any[];
      const commentCount = (db.prepare('SELECT COUNT(*) as c FROM comments WHERE storyId = ?').get(row.id) as any).c;

      return {
        ...row,
        isInactive: Boolean(row.isInactive),
        allowComments: Boolean(row.allowComments),
        isUnpublished: Boolean(row.isUnpublished),
        author,
        safetyFlags: flags.map((f) => f.flag),
        tags: tags.map((t) => t.name),
        episodes,
        likes,
        bookmarks,
        _count: {
          episodes: episodes.length,
          comments: commentCount,
          likes: likes.length
        }
      };
    },

    count: async ({ where = {} }: any = {}) => {
      let query = 'SELECT COUNT(*) as c FROM stories s WHERE s.isUnpublished = 0';
      const params: any[] = [];
      if (where.type) {
        query += ' AND s.type = ?';
        params.push(where.type);
      }
      if (where.status) {
        query += ' AND s.status = ?';
        params.push(where.status);
      }
      if (where.authorId && typeof where.authorId === 'string') {
        query += ' AND s.authorId = ?';
        params.push(where.authorId);
      }
      const res = db.prepare(query).get(...params) as any;
      return res.c;
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO stories (id, authorId, title, summary, oneliner, posterUrl, posterStyle, posterType, content, type, status, onHoldReason, isInactive, allowComments, viewsCount, likesCount, createdAt, updatedAt, publishedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
      `).run(
        id,
        data.authorId,
        data.title,
        data.summary,
        data.oneliner || null,
        data.posterUrl || null,
        data.posterStyle || 'bottom-gradient',
        data.posterType || 'PRESET',
        data.content || null,
        data.type,
        data.status || 'ONGOING',
        data.onHoldReason || null,
        data.isInactive ? 1 : 0,
        data.allowComments !== false ? 1 : 0,
        now,
        now,
        now
      );
      return prisma.story.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = db.prepare('SELECT * FROM stories WHERE id = ?').get(where.id) as any;
      if (!current) throw new Error('Story not found');

      const now = new Date().toISOString();
      const newTitle = data.title !== undefined ? data.title : current.title;
      const newSummary = data.summary !== undefined ? data.summary : current.summary;
      const newOneliner = data.oneliner !== undefined ? data.oneliner : current.oneliner;
      const newPosterUrl = data.posterUrl !== undefined ? data.posterUrl : current.posterUrl;
      const newPosterStyle = data.posterStyle !== undefined ? data.posterStyle : current.posterStyle;
      const newPosterType = data.posterType !== undefined ? data.posterType : current.posterType;
      const newContent = data.content !== undefined ? data.content : current.content;
      const newStatus = data.status !== undefined ? data.status : current.status;
      const newOnHold = data.onHoldReason !== undefined ? data.onHoldReason : current.onHoldReason;
      const newInactive = data.isInactive !== undefined ? (data.isInactive ? 1 : 0) : current.isInactive;
      const newInactiveTagged = data.inactiveTaggedAt !== undefined ? (data.inactiveTaggedAt ? new Date(data.inactiveTaggedAt).toISOString() : null) : current.inactiveTaggedAt;
      const newAllowComments = data.allowComments !== undefined ? (data.allowComments ? 1 : 0) : current.allowComments;
      const newUnpublished = data.isUnpublished !== undefined ? (data.isUnpublished ? 1 : 0) : current.isUnpublished;

      let newLikes = current.likesCount;
      if (data.likesCount?.increment) newLikes += data.likesCount.increment;
      else if (data.likesCount?.decrement) newLikes = Math.max(0, newLikes - data.likesCount.decrement);

      let newViews = current.viewsCount;
      if (data.viewsCount?.increment) newViews += data.viewsCount.increment;

      db.prepare(`
        UPDATE stories SET title = ?, summary = ?, oneliner = ?, posterUrl = ?, posterStyle = ?, posterType = ?, content = ?, status = ?, onHoldReason = ?, isInactive = ?, inactiveTaggedAt = ?, allowComments = ?, isUnpublished = ?, likesCount = ?, viewsCount = ?, updatedAt = ?
        WHERE id = ?
      `).run(
        newTitle,
        newSummary,
        newOneliner || null,
        newPosterUrl || null,
        newPosterStyle || 'bottom-gradient',
        newPosterType || 'PRESET',
        newContent || null,
        newStatus,
        newOnHold || null,
        newInactive,
        newInactiveTagged,
        newAllowComments,
        newUnpublished,
        newLikes,
        newViews,
        now,
        where.id
      );

      return prisma.story.findUnique({ where: { id: where.id } });
    }
  },

  episode: {
    findUnique: async ({ where }: any) => {
      let row: any = null;
      if (where.id) {
        row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(where.id);
      } else if (where.storyId_seasonNumber_episodeNumber) {
        const { storyId, seasonNumber, episodeNumber } = where.storyId_seasonNumber_episodeNumber;
        row = db.prepare('SELECT * FROM episodes WHERE storyId = ? AND seasonNumber = ? AND episodeNumber = ?').get(storyId, seasonNumber, episodeNumber);
      }
      if (!row) return null;
      const likes = db.prepare('SELECT userId FROM episode_likes WHERE episodeId = ?').all(row.id) as any[];
      const story = await prisma.story.findUnique({ where: { id: row.storyId } });

      return {
        ...row,
        likes,
        story
      };
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO episodes (id, storyId, seasonNumber, episodeNumber, title, content, status, onHoldReason, viewsCount, likesCount, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `).run(
        id,
        data.storyId,
        data.seasonNumber || 1,
        data.episodeNumber,
        data.title,
        data.content,
        data.status || 'COMPLETED',
        data.onHoldReason || null,
        now,
        now
      );
      return prisma.episode.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = db.prepare('SELECT * FROM episodes WHERE id = ?').get(where.id) as any;
      if (!current) throw new Error('Episode not found');

      const now = new Date().toISOString();
      let newLikes = current.likesCount;
      if (data.likesCount?.increment) newLikes += data.likesCount.increment;
      else if (data.likesCount?.decrement) newLikes = Math.max(0, newLikes - data.likesCount.decrement);

      let newViews = current.viewsCount;
      if (data.viewsCount?.increment) newViews += data.viewsCount.increment;

      db.prepare('UPDATE episodes SET likesCount = ?, viewsCount = ?, updatedAt = ? WHERE id = ?').run(
        newLikes,
        newViews,
        now,
        where.id
      );

      return prisma.episode.findUnique({ where: { id: where.id } });
    }
  },

  storySafetyFlag: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO story_safety_flags (id, storyId, flag) VALUES (?, ?, ?)').run(id, data.storyId, data.flag);
    },
    deleteMany: async ({ where }: { where: { storyId: string } }) => {
      db.prepare('DELETE FROM story_safety_flags WHERE storyId = ?').run(where.storyId);
    }
  },

  tag: {
    findMany: async ({ orderBy = {}, take = 20 }: any = {}) => {
      const rows = db.prepare(`
        SELECT t.*, COUNT(st.storyId) as storyCount
        FROM tags t
        LEFT JOIN story_tags st ON t.id = st.tagId
        GROUP BY t.id
        ORDER BY storyCount DESC
        LIMIT ${take}
      `).all() as any[];

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        _count: { stories: r.storyCount }
      }));
    },

    findUnique: async ({ where }: { where: { name?: string; id?: string } }) => {
      if (where.name) {
        return db.prepare('SELECT * FROM tags WHERE name = ?').get(where.name.toLowerCase()) as any;
      }
      if (where.id) {
        return db.prepare('SELECT * FROM tags WHERE id = ?').get(where.id) as any;
      }
      return null;
    },

    create: async ({ data }: { data: { name: string } }) => {
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, data.name.toLowerCase());
      return { id, name: data.name.toLowerCase() };
    }
  },

  storyTag: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO story_tags (id, storyId, tagId) VALUES (?, ?, ?)').run(id, data.storyId, data.tagId);
    },
    deleteMany: async ({ where }: { where: { storyId: string } }) => {
      db.prepare('DELETE FROM story_tags WHERE storyId = ?').run(where.storyId);
    }
  },

  storyLike: {
    findUnique: async ({ where }: any) => {
      const { userId, storyId } = where.userId_storyId;
      return db.prepare('SELECT * FROM story_likes WHERE userId = ? AND storyId = ?').get(userId, storyId) as any;
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO story_likes (id, userId, storyId, createdAt) VALUES (?, ?, ?, ?)').run(id, data.userId, data.storyId, now);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      db.prepare('DELETE FROM story_likes WHERE id = ?').run(where.id);
    }
  },

  episodeLike: {
    findUnique: async ({ where }: any) => {
      const { userId, episodeId } = where.userId_episodeId;
      return db.prepare('SELECT * FROM episode_likes WHERE userId = ? AND episodeId = ?').get(userId, episodeId) as any;
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO episode_likes (id, userId, episodeId, createdAt) VALUES (?, ?, ?, ?)').run(id, data.userId, data.episodeId, now);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      db.prepare('DELETE FROM episode_likes WHERE id = ?').run(where.id);
    }
  },

  storyView: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO story_views (id, userId, storyId, ipAddress, createdAt) VALUES (?, ?, ?, ?, ?)').run(
        id,
        data.userId || null,
        data.storyId,
        data.ipAddress || null,
        now
      );
    }
  },

  episodeView: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO episode_views (id, userId, episodeId, ipAddress, createdAt) VALUES (?, ?, ?, ?, ?)').run(
        id,
        data.userId || null,
        data.episodeId,
        data.ipAddress || null,
        now
      );
    }
  },

  comment: {
    findMany: async ({ where = {} }: any): Promise<any[]> => {
      let query = 'SELECT * FROM comments WHERE storyId = ?';
      const params: any[] = [where.storyId];

      if (where.parentId === null) {
        query += ' AND parentId IS NULL';
      } else if (where.parentId) {
        query += ' AND parentId = ?';
        params.push(where.parentId);
      }

      if (where.episodeId) {
        query += ' AND episodeId = ?';
        params.push(where.episodeId);
      }

      query += ' ORDER BY createdAt DESC';
      const rows = db.prepare(query).all(...params) as any[];

      return Promise.all(
        rows.map(async (c: any): Promise<any> => {
          const user = await prisma.user.findUnique({ where: { id: c.userId } });
          const likes = db.prepare('SELECT userId FROM comment_likes WHERE commentId = ?').all(c.id) as any[];
          const replies: any[] = await prisma.comment.findMany({ where: { storyId: c.storyId, parentId: c.id } });

          return {
            ...c,
            user,
            likes,
            replies,
            _count: { likes: likes.length }
          };
        })
      );
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = db.prepare('SELECT * FROM comments WHERE id = ?').get(where.id) as any;
      if (!row) return null;
      const user = await prisma.user.findUnique({ where: { id: row.userId } });
      const likes = db.prepare('SELECT userId FROM comment_likes WHERE commentId = ?').all(row.id) as any[];
      return {
        ...row,
        user,
        likes,
        _count: { likes: likes.length }
      };
    },

    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO comments (id, storyId, episodeId, userId, parentId, content, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.storyId,
        data.episodeId || null,
        data.userId,
        data.parentId || null,
        data.content,
        now,
        now
      );
      return prisma.comment.findUnique({ where: { id } });
    }
  },

  commentLike: {
    findUnique: async ({ where }: any) => {
      const { userId, commentId } = where.userId_commentId;
      return db.prepare('SELECT * FROM comment_likes WHERE userId = ? AND commentId = ?').get(userId, commentId) as any;
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO comment_likes (id, userId, commentId, createdAt) VALUES (?, ?, ?, ?)').run(id, data.userId, data.commentId, now);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      db.prepare('DELETE FROM comment_likes WHERE id = ?').run(where.id);
    },
    count: async ({ where }: { where: { commentId: string } }) => {
      const res = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE commentId = ?').get(where.commentId) as any;
      return res.c;
    }
  },

  follow: {
    findUnique: async ({ where }: any) => {
      const { followerId, followingId } = where.followerId_followingId;
      return db.prepare('SELECT * FROM follows WHERE followerId = ? AND followingId = ?').get(followerId, followingId) as any;
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO follows (id, followerId, followingId, createdAt) VALUES (?, ?, ?, ?)').run(id, data.followerId, data.followingId, now);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      db.prepare('DELETE FROM follows WHERE id = ?').run(where.id);
    },
    findMany: async ({ where }: { where: { followerId: string } }) => {
      return db.prepare('SELECT * FROM follows WHERE followerId = ?').all(where.followerId) as any[];
    },
    count: async ({ where }: any) => {
      if (where.followingId) {
        const res = db.prepare('SELECT COUNT(*) as c FROM follows WHERE followingId = ?').get(where.followingId) as any;
        return res.c;
      }
      if (where.followerId) {
        const res = db.prepare('SELECT COUNT(*) as c FROM follows WHERE followerId = ?').get(where.followerId) as any;
        return res.c;
      }
      return 0;
    }
  },

  bookmark: {
    findUnique: async ({ where }: any) => {
      const { userId, storyId } = where.userId_storyId;
      return db.prepare('SELECT * FROM bookmarks WHERE userId = ? AND storyId = ?').get(userId, storyId) as any;
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT OR IGNORE INTO bookmarks (id, userId, storyId, createdAt) VALUES (?, ?, ?, ?)').run(id, data.userId, data.storyId, now);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(where.id);
    },
    findMany: async ({ where }: { where: { userId: string } }) => {
      const rows = db.prepare('SELECT storyId FROM bookmarks WHERE userId = ? ORDER BY createdAt DESC').all(where.userId) as any[];
      return Promise.all(
        rows.map(async (r) => {
          const story = await prisma.story.findUnique({ where: { id: r.storyId } });
          return { story };
        })
      );
    }
  },

  report: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO reports (id, reporterId, storyId, episodeId, category, priority, status, reason, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.reporterId,
        data.storyId,
        data.episodeId || null,
        data.category,
        data.priority || 'NORMAL',
        data.status || 'PENDING',
        data.reason,
        now,
        now
      );
      return prisma.report.findUnique({ where: { id } });
    },

    findMany: async ({ where = {}, skip = 0, take = 20 }: any = {}) => {
      let query = 'SELECT * FROM reports WHERE 1=1';
      const params: any[] = [];
      if (where.priority) {
        query += ' AND priority = ?';
        params.push(where.priority);
      }
      if (where.status) {
        query += ' AND status = ?';
        params.push(where.status);
      }
      query += " ORDER BY CASE WHEN priority = 'HIGH' THEN 0 ELSE 1 END, createdAt ASC";
      query += ` LIMIT ${take} OFFSET ${skip}`;

      const rows = db.prepare(query).all(...params) as any[];
      return Promise.all(rows.map((r) => prisma.report.findUnique({ where: { id: r.id } })));
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(where.id) as any;
      if (!row) return null;
      const reporter = await prisma.user.findUnique({ where: { id: row.reporterId } });
      const story = await prisma.story.findUnique({ where: { id: row.storyId } });
      const episode = row.episodeId ? await prisma.episode.findUnique({ where: { id: row.episodeId } }) : null;
      const actions = db.prepare('SELECT * FROM moderation_actions WHERE reportId = ?').all(row.id) as any[];

      return {
        ...row,
        reporter,
        story,
        episode,
        actions
      };
    },

    count: async ({ where = {} }: any = {}) => {
      let query = 'SELECT COUNT(*) as c FROM reports WHERE 1=1';
      const params: any[] = [];
      if (where.priority) {
        query += ' AND priority = ?';
        params.push(where.priority);
      }
      if (where.status) {
        query += ' AND status = ?';
        params.push(where.status);
      }
      const res = db.prepare(query).get(...params) as any;
      return res.c;
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = db.prepare('SELECT * FROM reports WHERE id = ?').get(where.id) as any;
      if (!current) throw new Error('Report not found');

      const now = new Date().toISOString();
      const newStatus = data.status || current.status;
      const newNotes = data.moderatorNotes !== undefined ? data.moderatorNotes : current.moderatorNotes;
      const newResolver = data.resolvedById !== undefined ? data.resolvedById : current.resolvedById;
      const newResolvedAt = data.resolvedAt !== undefined ? new Date(data.resolvedAt).toISOString() : current.resolvedAt;

      db.prepare('UPDATE reports SET status = ?, moderatorNotes = ?, resolvedById = ?, resolvedAt = ?, updatedAt = ? WHERE id = ?').run(
        newStatus,
        newNotes,
        newResolver,
        newResolvedAt,
        now,
        where.id
      );

      return prisma.report.findUnique({ where: { id: where.id } });
    }
  },

  moderationAction: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO moderation_actions (id, reportId, moderatorId, actionType, targetType, targetId, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.reportId || null,
        data.moderatorId,
        data.actionType,
        data.targetType,
        data.targetId,
        data.notes,
        now
      );
    }
  }
};

// Formatters
export function formatUserProfile(
  user: any,
  counts?: { followers?: number; following?: number; stories?: number }
): UserProfile {
  const now = new Date();
  const lastChange = user.lastUsernameChangeAt ? new Date(user.lastUsernameChangeAt) : null;
  const daysSinceLastChange = lastChange
    ? Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const canChangeUsername =
    user.usernameChangesCount === 0 || daysSinceLastChange >= 30;
  const daysUntilNextUsernameChange = canChangeUsername
    ? 0
    : Math.max(0, 30 - daysSinceLastChange);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    role: user.role as UserRole,
    followersCount: counts?.followers ?? (user._count?.followers ?? 0),
    followingCount: counts?.following ?? (user._count?.following ?? 0),
    storiesCount: counts?.stories ?? (user._count?.stories ?? 0),
    lastUsernameChangeAt: user.lastUsernameChangeAt ? new Date(user.lastUsernameChangeAt).toISOString() : null,
    usernameChangesCount: user.usernameChangesCount || 0,
    canChangeUsername,
    daysUntilNextUsernameChange,
    createdAt: new Date(user.createdAt).toISOString()
  };
}

export function formatAuthUser(user: any): AuthUser {
  return {
    ...formatUserProfile(user),
    email: user.email
  };
}

export function formatStory(story: any, viewerId?: string): Story {
  const safetyFlags: SafetyFlag[] = (story.safetyFlags || []).map(
    (f: any) => (typeof f === 'string' ? f : f.flag) as SafetyFlag
  );
  const tags: string[] = (story.tags || []).map((t: any) =>
    typeof t === 'string' ? t : t.tag?.name || t.name
  );

  let isLikedByViewer = false;
  let isBookmarkedByViewer = false;

  if (viewerId) {
    if (story.likes && Array.isArray(story.likes)) {
      isLikedByViewer = story.likes.some((l: any) => l.userId === viewerId || l === viewerId);
    }
    if (story.bookmarks && Array.isArray(story.bookmarks)) {
      isBookmarkedByViewer = story.bookmarks.some((b: any) => b.userId === viewerId || b === viewerId);
    }
  }

  let totalWords = (story.summary || '').split(/\s+/).length;
  if (story.content) {
    totalWords += story.content.split(/\s+/).length;
  }
  if (story.episodes && Array.isArray(story.episodes)) {
    for (const ep of story.episodes) {
      totalWords += (ep.content || '').split(/\s+/).length;
    }
  }
  const readingTimeMinutes = Math.max(1, Math.ceil(totalWords / 200));

  return {
    id: story.id,
    authorId: story.authorId,
    author: story.author ? formatUserProfile(story.author) : ({} as any),
    title: story.title,
    summary: story.summary,
    oneliner: story.oneliner || null,
    posterUrl: story.posterUrl || null,
    posterStyle: story.posterStyle || 'bottom-gradient',
    posterType: story.posterType || 'PRESET',
    content: story.content || undefined,
    type: story.type as StoryType,
    status: story.status as StoryStatus,
    onHoldReason: story.onHoldReason,
    isInactive: Boolean(story.isInactive),
    inactiveTaggedAt: story.inactiveTaggedAt ? new Date(story.inactiveTaggedAt).toISOString() : null,
    allowComments: story.allowComments !== false && story.allowComments !== 0,
    safetyFlags,
    tags,
    viewsCount: story.viewsCount || 0,
    likesCount: story.likesCount || 0,
    commentsCount: story.commentsCount ?? (story.comments?.length ?? story._count?.comments ?? 0),
    episodesCount: story.episodes?.length || story._count?.episodes || 0,
    readingTimeMinutes,
    isLikedByViewer,
    isBookmarkedByViewer,
    episodes: story.episodes ? story.episodes.map((ep: any) => formatEpisode(ep, viewerId)) : undefined,
    createdAt: new Date(story.createdAt).toISOString(),
    updatedAt: new Date(story.updatedAt).toISOString(),
    publishedAt: story.publishedAt ? new Date(story.publishedAt).toISOString() : null
  };
}

export function formatEpisode(ep: any, viewerId?: string): Episode {
  let isLikedByViewer = false;
  if (viewerId && ep.likes && Array.isArray(ep.likes)) {
    isLikedByViewer = ep.likes.some((l: any) => l.userId === viewerId || l === viewerId);
  }

  const words = (ep.content || '').split(/\s+/).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    id: ep.id,
    storyId: ep.storyId,
    seasonNumber: ep.seasonNumber || 1,
    episodeNumber: ep.episodeNumber,
    title: ep.title,
    content: ep.content,
    status: ep.status as EpisodeStatus,
    onHoldReason: ep.onHoldReason,
    viewsCount: ep.viewsCount || 0,
    likesCount: ep.likesCount || 0,
    readingTimeMinutes,
    isLikedByViewer,
    createdAt: new Date(ep.createdAt).toISOString(),
    updatedAt: new Date(ep.updatedAt).toISOString()
  };
}

export function formatComment(comment: any, viewerId?: string): Comment {
  let isLikedByViewer = false;
  if (viewerId && comment.likes && Array.isArray(comment.likes)) {
    isLikedByViewer = comment.likes.some((l: any) => l.userId === viewerId || l === viewerId);
  }

  return {
    id: comment.id,
    storyId: comment.storyId,
    episodeId: comment.episodeId,
    userId: comment.userId,
    user: comment.user ? formatUserProfile(comment.user) : ({} as any),
    content: comment.content,
    parentId: comment.parentId,
    likesCount: comment.likes?.length || comment._count?.likes || 0,
    isLikedByViewer,
    replies: comment.replies ? comment.replies.map((r: any) => formatComment(r, viewerId)) : undefined,
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString()
  };
}
