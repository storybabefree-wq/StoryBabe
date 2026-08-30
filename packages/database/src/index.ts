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

// Robust workspace root discovery for persistent database access across microservices
function findWorkspaceDataDir(): string {
  if (process.env.DATABASE_FILE_PATH) {
    const customDir = path.dirname(process.env.DATABASE_FILE_PATH);
    if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
    return customDir;
  }
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, 'data');
    if (
      fs.existsSync(path.join(current, 'bun.lock')) ||
      (fs.existsSync(path.join(current, 'package.json')) && fs.existsSync(path.join(current, 'services')))
    ) {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const fallback = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const dbDir = findWorkspaceDataDir();
const dbPath = process.env.DATABASE_FILE_PATH || path.join(dbDir, 'storybabe.db');

export const db = new DatabaseSync(dbPath);

// Enable WAL mode, busy timeout and safe concurrency for SQLite
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 10000;');
  db.exec('PRAGMA synchronous = NORMAL;');
} catch (e) {
  // Ignored
}

// Initialize schema tables safely
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      displayName TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      bio TEXT,
      avatarUrl TEXT,
      role TEXT DEFAULT 'AUTHOR',
      lastUsernameChangeAt TEXT,
      usernameChangesCount INTEGER DEFAULT 0,
      emailVerified INTEGER DEFAULT 0,
      emailVerifiedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      expiresAt TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
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
} catch (e) {
  // Schema already created by another worker
}

// Safe migrations for existing SQLite database using PRAGMA table_info
try {
  const storyTableInfo = db.prepare("PRAGMA table_info(stories)").all() as any[];
  const storyCols = new Set(storyTableInfo.map((c) => c.name));
  if (!storyCols.has('oneliner')) {
    db.exec('ALTER TABLE stories ADD COLUMN oneliner TEXT');
  }
  if (!storyCols.has('posterUrl')) {
    db.exec('ALTER TABLE stories ADD COLUMN posterUrl TEXT');
  }
  if (!storyCols.has('posterStyle')) {
    db.exec("ALTER TABLE stories ADD COLUMN posterStyle TEXT DEFAULT 'bottom-gradient'");
  }
  if (!storyCols.has('posterType')) {
    db.exec("ALTER TABLE stories ADD COLUMN posterType TEXT DEFAULT 'PRESET'");
  }

  const userTableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const userCols = new Set(userTableInfo.map((c) => c.name));
  if (!userCols.has('emailVerified')) {
    db.exec('ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0');
  }
  if (!userCols.has('emailVerifiedAt')) {
    db.exec('ALTER TABLE users ADD COLUMN emailVerifiedAt TEXT');
  }

  // Migrate existing users table to remove UNIQUE constraint on email if present
  const masterSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any)?.sql || '';
  if (masterSql.includes('email TEXT UNIQUE NOT NULL') || masterSql.includes('email TEXT NOT NULL UNIQUE')) {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        bio TEXT,
        avatarUrl TEXT,
        role TEXT DEFAULT 'AUTHOR',
        lastUsernameChangeAt TEXT,
        usernameChangesCount INTEGER DEFAULT 0,
        emailVerified INTEGER DEFAULT 0,
        emailVerifiedAt TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      INSERT OR IGNORE INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
  }
} catch (e) {
  // Migration already handled
}

// Cleanup any legacy demo/testing seeds from database
try {
  db.exec(`
    DELETE FROM users WHERE email LIKE '%@storybabe.internal' OR email LIKE '%@internal.test';
    DELETE FROM stories WHERE authorId LIKE 'user-elena%' OR authorId LIKE 'user-marcus%' OR authorId LIKE 'user-sarah%' OR authorId LIKE 'user-mod%';
    DELETE FROM episodes WHERE storyId IN ('story-1', 'story-2', 'story-3', 'story-4');
  `);
} catch (e) {
  // Ignore
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
        emailVerified: Boolean(row.emailVerified),
        emailVerifiedAt: row.emailVerifiedAt ? new Date(row.emailVerifiedAt).toISOString() : null,
        _count: {
          followers: followersCount,
          following: followingCount,
          stories: storiesCount
        }
      };
    },

    findFirst: async ({ where }: { where: { OR?: Array<{ email?: string; username?: string }>; email?: string; username?: string } }) => {
      if (where.username) {
        return prisma.user.findUnique({ where: { username: where.username } });
      }
      if (where.email) {
        const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1').get(where.email) as any;
        if (!row) return null;
        return prisma.user.findUnique({ where: { id: row.id } });
      }
      if (where.OR && where.OR.length > 0) {
        for (const item of where.OR) {
          if (item.username) {
            const res = await prisma.user.findUnique({ where: { username: item.username } });
            if (res) return res;
          }
          if (item.email) {
            const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1').get(item.email) as any;
            if (row) return prisma.user.findUnique({ where: { id: row.id } });
          }
        }
      }
      return null;
    },

    findMany: async ({ where = {} }: any = {}) => {
      let query = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];
      if (where.email) {
        query += ' AND LOWER(email) = LOWER(?)';
        params.push(where.email);
      }
      const rows = db.prepare(query).all(...params) as any[];
      return Promise.all(rows.map((row) => prisma.user.findUnique({ where: { id: row.id } })));
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, email, username, displayName, passwordHash, bio, avatarUrl, role, lastUsernameChangeAt, usernameChangesCount, emailVerified, emailVerifiedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.emailVerified ? 1 : 0,
        data.emailVerifiedAt ? new Date(data.emailVerifiedAt).toISOString() : (data.emailVerified ? now : null),
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
      const newPasswordHash = data.passwordHash !== undefined ? data.passwordHash : current.passwordHash;
      const newEmailVerified = data.emailVerified !== undefined ? (data.emailVerified ? 1 : 0) : current.emailVerified;
      const newEmailVerifiedAt = data.emailVerifiedAt !== undefined ? (data.emailVerifiedAt ? new Date(data.emailVerifiedAt).toISOString() : null) : current.emailVerifiedAt;
      const newLastChange = data.lastUsernameChangeAt !== undefined ? (data.lastUsernameChangeAt ? new Date(data.lastUsernameChangeAt).toISOString() : null) : current.lastUsernameChangeAt;
      const newChangeCount = data.usernameChangesCount?.increment !== undefined ? current.usernameChangesCount + 1 : (data.usernameChangesCount !== undefined ? data.usernameChangesCount : current.usernameChangesCount);

      db.prepare(`
        UPDATE users SET username = ?, displayName = ?, bio = ?, avatarUrl = ?, passwordHash = ?, emailVerified = ?, emailVerifiedAt = ?, lastUsernameChangeAt = ?, usernameChangesCount = ?, updatedAt = ?
        WHERE id = ?
      `).run(newUsername, newDisplayName, newBio, newAvatarUrl, newPasswordHash, newEmailVerified, newEmailVerifiedAt, newLastChange, newChangeCount, now, where.id);

      return prisma.user.findUnique({ where: { id: where.id } });
    },

    count: async ({ where }: { where?: any } = {}) => {
      let query = 'SELECT COUNT(*) as c FROM users WHERE 1=1';
      const params: any[] = [];
      if (where?.email) {
        query += ' AND LOWER(email) = LOWER(?)';
        params.push(where.email);
      }
      if (where?.username) {
        query += ' AND LOWER(username) = LOWER(?)';
        params.push(where.username);
      }
      const res = db.prepare(query).get(...params) as any;
      return res?.c || 0;
    }
  },

  otpVerification: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO otp_verifications (id, email, code, type, payload, expiresAt, attempts, verified, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.email.toLowerCase(),
        data.code,
        data.type,
        data.payload || null,
        new Date(data.expiresAt).toISOString(),
        data.attempts || 0,
        data.verified ? 1 : 0,
        now
      );
      return prisma.otpVerification.findUnique({ where: { id } });
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = db.prepare('SELECT * FROM otp_verifications WHERE id = ?').get(where.id) as any;
      if (!row) return null;
      return {
        ...row,
        verified: Boolean(row.verified)
      };
    },

    findFirst: async ({ where }: any) => {
      let query = 'SELECT * FROM otp_verifications WHERE 1=1';
      const params: any[] = [];
      if (where.email) {
        query += ' AND LOWER(email) = LOWER(?)';
        params.push(where.email);
      }
      if (where.type) {
        query += ' AND type = ?';
        params.push(where.type);
      }
      if (where.code) {
        query += ' AND code = ?';
        params.push(where.code);
      }
      if (where.verified !== undefined) {
        query += ' AND verified = ?';
        params.push(where.verified ? 1 : 0);
      }
      query += ' ORDER BY createdAt DESC LIMIT 1';
      const row = db.prepare(query).get(...params) as any;
      if (!row) return null;
      return {
        ...row,
        verified: Boolean(row.verified)
      };
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = db.prepare('SELECT * FROM otp_verifications WHERE id = ?').get(where.id) as any;
      if (!current) throw new Error('OTP verification not found');

      let newAttempts = current.attempts;
      if (data.attempts?.increment) newAttempts += data.attempts.increment;
      else if (data.attempts !== undefined) newAttempts = data.attempts;

      const newVerified = data.verified !== undefined ? (data.verified ? 1 : 0) : current.verified;

      db.prepare('UPDATE otp_verifications SET attempts = ?, verified = ? WHERE id = ?').run(
        newAttempts,
        newVerified,
        where.id
      );

      return prisma.otpVerification.findUnique({ where: { id: where.id } });
    },

    deleteMany: async ({ where }: any) => {
      let query = 'DELETE FROM otp_verifications WHERE 1=1';
      const params: any[] = [];
      if (where.email) {
        query += ' AND LOWER(email) = LOWER(?)';
        params.push(where.email);
      }
      if (where.type) {
        query += ' AND type = ?';
        params.push(where.type);
      }
      db.prepare(query).run(...params);
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
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toISOString() : null,
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
