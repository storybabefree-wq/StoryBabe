import pg from 'pg';
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

// PostgreSQL Connection Pool
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[Database] FATAL: DATABASE_URL environment variable is required.');
  console.error('[Database] Set DATABASE_URL to your Supabase/Neon PostgreSQL connection string.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected pool error:', err.message);
});

// Helper: run a query
async function query(sql: string, params: any[] = []): Promise<any[]> {
  const res = await pool.query(sql, params);
  return res.rows;
}

// Helper: run a query and get first row
async function queryOne(sql: string, params: any[] = []): Promise<any | null> {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

// Helper: execute a statement (INSERT/UPDATE/DELETE)
async function execute(sql: string, params: any[] = []): Promise<void> {
  await pool.query(sql, params);
}

// Initialize schema tables
async function initializeSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      "displayName" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      bio TEXT,
      "avatarUrl" TEXT,
      role TEXT DEFAULT 'AUTHOR',
      "lastUsernameChangeAt" TEXT,
      "usernameChangesCount" INTEGER DEFAULT 0,
      "emailVerified" BOOLEAN DEFAULT false,
      "emailVerifiedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      "expiresAt" TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      verified BOOLEAN DEFAULT false,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS username_history (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "oldUsername" TEXT NOT NULL,
      "newUsername" TEXT NOT NULL,
      "changedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      "authorId" TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      oneliner TEXT,
      "posterUrl" TEXT,
      "posterStyle" TEXT DEFAULT 'bottom-gradient',
      "posterType" TEXT DEFAULT 'PRESET',
      content TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'ONGOING',
      "onHoldReason" TEXT,
      "isInactive" BOOLEAN DEFAULT false,
      "inactiveTaggedAt" TEXT,
      "allowComments" BOOLEAN DEFAULT true,
      "viewsCount" INTEGER DEFAULT 0,
      "likesCount" INTEGER DEFAULT 0,
      "isUnpublished" BOOLEAN DEFAULT false,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "publishedAt" TEXT
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "seasonNumber" INTEGER DEFAULT 1,
      "episodeNumber" INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      "onHoldReason" TEXT,
      "viewsCount" INTEGER DEFAULT 0,
      "likesCount" INTEGER DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      UNIQUE("storyId", "seasonNumber", "episodeNumber")
    );

    CREATE TABLE IF NOT EXISTS story_safety_flags (
      id TEXT PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      flag TEXT NOT NULL,
      UNIQUE("storyId", flag)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_tags (
      id TEXT PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "tagId" TEXT NOT NULL,
      UNIQUE("storyId", "tagId")
    );

    CREATE TABLE IF NOT EXISTS story_likes (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "storyId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "storyId")
    );

    CREATE TABLE IF NOT EXISTS episode_likes (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "episodeId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "episodeId")
    );

    CREATE TABLE IF NOT EXISTS story_views (
      id TEXT PRIMARY KEY,
      "userId" TEXT,
      "storyId" TEXT NOT NULL,
      "ipAddress" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episode_views (
      id TEXT PRIMARY KEY,
      "userId" TEXT,
      "episodeId" TEXT NOT NULL,
      "ipAddress" TEXT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "episodeId" TEXT,
      "userId" TEXT NOT NULL,
      "parentId" TEXT,
      content TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "commentId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "commentId")
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      "followerId" TEXT NOT NULL,
      "followingId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("followerId", "followingId")
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "storyId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      UNIQUE("userId", "storyId")
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      "reporterId" TEXT NOT NULL,
      "storyId" TEXT NOT NULL,
      "episodeId" TEXT,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'NORMAL',
      status TEXT DEFAULT 'PENDING',
      reason TEXT NOT NULL,
      "moderatorNotes" TEXT,
      "resolvedById" TEXT,
      "resolvedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id TEXT PRIMARY KEY,
      "reportId" TEXT,
      "moderatorId" TEXT NOT NULL,
      "actionType" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      notes TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_stories_authorid ON stories("authorId");
    CREATE INDEX IF NOT EXISTS idx_stories_created ON stories("createdAt");
    CREATE INDEX IF NOT EXISTS idx_episodes_storyid ON episodes("storyId");
    CREATE INDEX IF NOT EXISTS idx_comments_storyid ON comments("storyId");
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows("followerId");
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows("followingId");
    CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
  `);
  console.log('[Database] PostgreSQL schema initialized successfully.');
}

// Run schema init on module load
initializeSchema().catch((err) => {
  console.error('[Database] Schema initialization failed:', err.message);
});

// Export pool for direct access if needed
export const db = pool;

// -------------------------------------------------------------
// Type-safe Prisma-like Database abstraction (PostgreSQL)
// -------------------------------------------------------------

export const prisma = {
  $transaction: async (fn: (tx: any) => Promise<any>) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await fn(prisma);
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string; username?: string } }) => {
      let row: any = null;
      if (where.id) {
        row = await queryOne('SELECT * FROM users WHERE id = $1', [where.id]);
      } else if (where.email) {
        row = await queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [where.email]);
      } else if (where.username) {
        row = await queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [where.username]);
      }
      if (!row) return null;

      const followersCount = (await queryOne('SELECT COUNT(*) as c FROM follows WHERE "followingId" = $1', [row.id]))?.c || 0;
      const followingCount = (await queryOne('SELECT COUNT(*) as c FROM follows WHERE "followerId" = $1', [row.id]))?.c || 0;
      const storiesCount = (await queryOne('SELECT COUNT(*) as c FROM stories WHERE "authorId" = $1 AND "isUnpublished" = false', [row.id]))?.c || 0;

      return {
        ...row,
        emailVerified: Boolean(row.emailVerified),
        emailVerifiedAt: row.emailVerifiedAt ? new Date(row.emailVerifiedAt).toISOString() : null,
        _count: {
          followers: Number(followersCount),
          following: Number(followingCount),
          stories: Number(storiesCount)
        }
      };
    },

    findFirst: async ({ where }: { where: { OR?: Array<{ email?: string; username?: string }>; email?: string; username?: string } }) => {
      if (where.username) {
        return prisma.user.findUnique({ where: { username: where.username } });
      }
      if (where.email) {
        const row = await queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [where.email]);
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
            const row = await queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [item.email]);
            if (row) return prisma.user.findUnique({ where: { id: row.id } });
          }
        }
      }
      return null;
    },

    findMany: async ({ where = {} }: any = {}) => {
      let sql = 'SELECT * FROM users WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where.email) {
        sql += ` AND LOWER(email) = LOWER($${idx++})`;
        params.push(where.email);
      }
      const rows = await query(sql, params);
      return Promise.all(rows.map((row) => prisma.user.findUnique({ where: { id: row.id } })));
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      await execute(`
        INSERT INTO users (id, email, username, "displayName", "passwordHash", bio, "avatarUrl", role, "lastUsernameChangeAt", "usernameChangesCount", "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
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
        data.emailVerified ? true : false,
        data.emailVerifiedAt ? new Date(data.emailVerifiedAt).toISOString() : (data.emailVerified ? now : null),
        now,
        now
      ]);
      return prisma.user.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = await queryOne('SELECT * FROM users WHERE id = $1', [where.id]);
      if (!current) throw new Error('User not found');

      const now = new Date().toISOString();
      const newUsername = data.username !== undefined ? data.username.toLowerCase() : current.username;
      const newDisplayName = data.displayName !== undefined ? data.displayName : current.displayName;
      const newBio = data.bio !== undefined ? data.bio : current.bio;
      const newAvatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : current.avatarUrl;
      const newPasswordHash = data.passwordHash !== undefined ? data.passwordHash : current.passwordHash;
      const newEmailVerified = data.emailVerified !== undefined ? Boolean(data.emailVerified) : Boolean(current.emailVerified);
      const newEmailVerifiedAt = data.emailVerifiedAt !== undefined ? (data.emailVerifiedAt ? new Date(data.emailVerifiedAt).toISOString() : null) : current.emailVerifiedAt;
      const newLastChange = data.lastUsernameChangeAt !== undefined ? (data.lastUsernameChangeAt ? new Date(data.lastUsernameChangeAt).toISOString() : null) : current.lastUsernameChangeAt;
      const newChangeCount = data.usernameChangesCount?.increment !== undefined ? current.usernameChangesCount + 1 : (data.usernameChangesCount !== undefined ? data.usernameChangesCount : current.usernameChangesCount);

      await execute(`
        UPDATE users SET username = $1, "displayName" = $2, bio = $3, "avatarUrl" = $4, "passwordHash" = $5, "emailVerified" = $6, "emailVerifiedAt" = $7, "lastUsernameChangeAt" = $8, "usernameChangesCount" = $9, "updatedAt" = $10
        WHERE id = $11
      `, [newUsername, newDisplayName, newBio, newAvatarUrl, newPasswordHash, newEmailVerified, newEmailVerifiedAt, newLastChange, newChangeCount, now, where.id]);

      return prisma.user.findUnique({ where: { id: where.id } });
    },

    count: async ({ where }: { where?: any } = {}) => {
      let sql = 'SELECT COUNT(*) as c FROM users WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where?.email) {
        sql += ` AND LOWER(email) = LOWER($${idx++})`;
        params.push(where.email);
      }
      if (where?.username) {
        sql += ` AND LOWER(username) = LOWER($${idx++})`;
        params.push(where.username);
      }
      const res = await queryOne(sql, params);
      return Number(res?.c || 0);
    }
  },

  otpVerification: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      await execute(`
        INSERT INTO otp_verifications (id, email, code, type, payload, "expiresAt", attempts, verified, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        id,
        data.email.toLowerCase(),
        data.code,
        data.type,
        data.payload || null,
        new Date(data.expiresAt).toISOString(),
        data.attempts || 0,
        data.verified ? true : false,
        now
      ]);
      return prisma.otpVerification.findUnique({ where: { id } });
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = await queryOne('SELECT * FROM otp_verifications WHERE id = $1', [where.id]);
      if (!row) return null;
      return {
        ...row,
        verified: Boolean(row.verified)
      };
    },

    findFirst: async ({ where }: any) => {
      let sql = 'SELECT * FROM otp_verifications WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where.email) {
        sql += ` AND LOWER(email) = LOWER($${idx++})`;
        params.push(where.email);
      }
      if (where.type) {
        sql += ` AND type = $${idx++}`;
        params.push(where.type);
      }
      if (where.code) {
        sql += ` AND code = $${idx++}`;
        params.push(where.code);
      }
      if (where.verified !== undefined) {
        sql += ` AND verified = $${idx++}`;
        params.push(Boolean(where.verified));
      }
      sql += ' ORDER BY "createdAt" DESC LIMIT 1';
      const row = await queryOne(sql, params);
      if (!row) return null;
      return {
        ...row,
        verified: Boolean(row.verified)
      };
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = await queryOne('SELECT * FROM otp_verifications WHERE id = $1', [where.id]);
      if (!current) throw new Error('OTP verification not found');

      let newAttempts = current.attempts;
      if (data.attempts?.increment) newAttempts += data.attempts.increment;
      else if (data.attempts !== undefined) newAttempts = data.attempts;

      const newVerified = data.verified !== undefined ? Boolean(data.verified) : Boolean(current.verified);

      await execute('UPDATE otp_verifications SET attempts = $1, verified = $2 WHERE id = $3', [
        newAttempts,
        newVerified,
        where.id
      ]);

      return prisma.otpVerification.findUnique({ where: { id: where.id } });
    },

    deleteMany: async ({ where }: any) => {
      let sql = 'DELETE FROM otp_verifications WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where.email) {
        sql += ` AND LOWER(email) = LOWER($${idx++})`;
        params.push(where.email);
      }
      if (where.type) {
        sql += ` AND type = $${idx++}`;
        params.push(where.type);
      }
      await execute(sql, params);
    }
  },

  usernameHistory: {
    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO username_history (id, "userId", "oldUsername", "newUsername", "changedAt") VALUES ($1, $2, $3, $4, $5)', [
        id,
        data.userId,
        data.oldUsername,
        data.newUsername,
        now
      ]);
    }
  },

  story: {
    findMany: async ({ where = {}, orderBy = {}, skip = 0, take = 20 }: any = {}) => {
      let sql = 'SELECT s.* FROM stories s WHERE s."isUnpublished" = false';
      const params: any[] = [];
      let idx = 1;

      if (where.type) {
        sql += ` AND s.type = $${idx++}`;
        params.push(where.type);
      }
      if (where.status) {
        sql += ` AND s.status = $${idx++}`;
        params.push(where.status);
      }
      if (where.authorId) {
        if (typeof where.authorId === 'string') {
          sql += ` AND s."authorId" = $${idx++}`;
          params.push(where.authorId);
        } else if (where.authorId.in && Array.isArray(where.authorId.in)) {
          if (where.authorId.in.length === 0) return [];
          const placeholders = where.authorId.in.map((_: any) => `$${idx++}`).join(',');
          sql += ` AND s."authorId" IN (${placeholders})`;
          params.push(...where.authorId.in);
        }
      }
      if (where.isInactive !== undefined) {
        sql += ` AND s."isInactive" = $${idx++}`;
        params.push(Boolean(where.isInactive));
      }

      if (where.tag || (where.tags && where.tags.some)) {
        const tagToMatch = where.tag || where.tags.some.tag.name.equals;
        sql += ` AND s.id IN (SELECT st."storyId" FROM story_tags st JOIN tags t ON st."tagId" = t.id WHERE t.name = $${idx++})`;
        params.push(tagToMatch.toLowerCase());
      }

      if (where.safetyFlag || (where.safetyFlags && where.safetyFlags.some)) {
        const flagToMatch = where.safetyFlag || where.safetyFlags.some.flag;
        sql += ` AND s.id IN (SELECT ssf."storyId" FROM story_safety_flags ssf WHERE ssf.flag = $${idx++})`;
        params.push(flagToMatch);
      }

      if (where.OR) {
        const searchVal = where.OR[0]?.title?.contains || '';
        if (searchVal) {
          const likePattern = `%${searchVal}%`;
          sql += ` AND (s.title ILIKE $${idx++} OR s.summary ILIKE $${idx++} OR s.content ILIKE $${idx++})`;
          params.push(likePattern, likePattern, likePattern);
        }
      }

      sql += ` ORDER BY s."createdAt" DESC`;
      sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(take, skip);

      const rows = await query(sql, params);
      return Promise.all(rows.map((row) => prisma.story.findUnique({ where: { id: row.id } })));
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = await queryOne('SELECT * FROM stories WHERE id = $1', [where.id]);
      if (!row) return null;

      const author = await prisma.user.findUnique({ where: { id: row.authorId } });
      const flags = await query('SELECT flag FROM story_safety_flags WHERE "storyId" = $1', [row.id]);
      const tags = await query('SELECT t.name FROM story_tags st JOIN tags t ON st."tagId" = t.id WHERE st."storyId" = $1', [row.id]);
      const episodes = await query('SELECT * FROM episodes WHERE "storyId" = $1 ORDER BY "seasonNumber" ASC, "episodeNumber" ASC', [row.id]);
      const likes = await query('SELECT "userId" FROM story_likes WHERE "storyId" = $1', [row.id]);
      const bookmarks = await query('SELECT "userId" FROM bookmarks WHERE "storyId" = $1', [row.id]);
      const commentCount = (await queryOne('SELECT COUNT(*) as c FROM comments WHERE "storyId" = $1', [row.id]))?.c || 0;

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
          comments: Number(commentCount),
          likes: likes.length
        }
      };
    },

    count: async ({ where = {} }: any = {}) => {
      let sql = 'SELECT COUNT(*) as c FROM stories s WHERE s."isUnpublished" = false';
      const params: any[] = [];
      let idx = 1;
      if (where.type) {
        sql += ` AND s.type = $${idx++}`;
        params.push(where.type);
      }
      if (where.status) {
        sql += ` AND s.status = $${idx++}`;
        params.push(where.status);
      }
      if (where.authorId && typeof where.authorId === 'string') {
        sql += ` AND s."authorId" = $${idx++}`;
        params.push(where.authorId);
      }
      const res = await queryOne(sql, params);
      return Number(res?.c || 0);
    },

    create: async ({ data }: { data: any }) => {
      const id = data.id || crypto.randomUUID();
      const now = new Date().toISOString();
      await execute(`
        INSERT INTO stories (id, "authorId", title, summary, oneliner, "posterUrl", "posterStyle", "posterType", content, type, status, "onHoldReason", "isInactive", "allowComments", "viewsCount", "likesCount", "createdAt", "updatedAt", "publishedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, $15, $16, $17)
      `, [
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
        data.isInactive ? true : false,
        data.allowComments !== false ? true : false,
        now,
        now,
        now
      ]);
      return prisma.story.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = await queryOne('SELECT * FROM stories WHERE id = $1', [where.id]);
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
      const newInactive = data.isInactive !== undefined ? Boolean(data.isInactive) : Boolean(current.isInactive);
      const newInactiveTagged = data.inactiveTaggedAt !== undefined ? (data.inactiveTaggedAt ? new Date(data.inactiveTaggedAt).toISOString() : null) : current.inactiveTaggedAt;
      const newAllowComments = data.allowComments !== undefined ? Boolean(data.allowComments) : Boolean(current.allowComments);
      const newUnpublished = data.isUnpublished !== undefined ? Boolean(data.isUnpublished) : Boolean(current.isUnpublished);

      let newLikes = current.likesCount;
      if (data.likesCount?.increment) newLikes += data.likesCount.increment;
      else if (data.likesCount?.decrement) newLikes = Math.max(0, newLikes - data.likesCount.decrement);

      let newViews = current.viewsCount;
      if (data.viewsCount?.increment) newViews += data.viewsCount.increment;

      await execute(`
        UPDATE stories SET title = $1, summary = $2, oneliner = $3, "posterUrl" = $4, "posterStyle" = $5, "posterType" = $6, content = $7, status = $8, "onHoldReason" = $9, "isInactive" = $10, "inactiveTaggedAt" = $11, "allowComments" = $12, "isUnpublished" = $13, "likesCount" = $14, "viewsCount" = $15, "updatedAt" = $16
        WHERE id = $17
      `, [
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
      ]);

      return prisma.story.findUnique({ where: { id: where.id } });
    }
  },

  episode: {
    findUnique: async ({ where }: any) => {
      let row: any = null;
      if (where.id) {
        row = await queryOne('SELECT * FROM episodes WHERE id = $1', [where.id]);
      } else if (where.storyId_seasonNumber_episodeNumber) {
        const { storyId, seasonNumber, episodeNumber } = where.storyId_seasonNumber_episodeNumber;
        row = await queryOne('SELECT * FROM episodes WHERE "storyId" = $1 AND "seasonNumber" = $2 AND "episodeNumber" = $3', [storyId, seasonNumber, episodeNumber]);
      }
      if (!row) return null;
      const likes = await query('SELECT "userId" FROM episode_likes WHERE "episodeId" = $1', [row.id]);
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
      await execute(`
        INSERT INTO episodes (id, "storyId", "seasonNumber", "episodeNumber", title, content, status, "onHoldReason", "viewsCount", "likesCount", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9, $10)
      `, [
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
      ]);
      return prisma.episode.findUnique({ where: { id } });
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = await queryOne('SELECT * FROM episodes WHERE id = $1', [where.id]);
      if (!current) throw new Error('Episode not found');

      const now = new Date().toISOString();
      let newLikes = current.likesCount;
      if (data.likesCount?.increment) newLikes += data.likesCount.increment;
      else if (data.likesCount?.decrement) newLikes = Math.max(0, newLikes - data.likesCount.decrement);

      let newViews = current.viewsCount;
      if (data.viewsCount?.increment) newViews += data.viewsCount.increment;

      await execute('UPDATE episodes SET "likesCount" = $1, "viewsCount" = $2, "updatedAt" = $3 WHERE id = $4', [
        newLikes,
        newViews,
        now,
        where.id
      ]);

      return prisma.episode.findUnique({ where: { id: where.id } });
    }
  },

  storySafetyFlag: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      await execute('INSERT INTO story_safety_flags (id, "storyId", flag) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, data.storyId, data.flag]);
    },
    deleteMany: async ({ where }: { where: { storyId: string } }) => {
      await execute('DELETE FROM story_safety_flags WHERE "storyId" = $1', [where.storyId]);
    }
  },

  tag: {
    findMany: async ({ orderBy = {}, take = 20 }: any = {}) => {
      const rows = await query(`
        SELECT t.*, COUNT(st."storyId") as "storyCount"
        FROM tags t
        LEFT JOIN story_tags st ON t.id = st."tagId"
        GROUP BY t.id
        ORDER BY "storyCount" DESC
        LIMIT $1
      `, [take]);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        _count: { stories: Number(r.storyCount) }
      }));
    },

    findUnique: async ({ where }: { where: { name?: string; id?: string } }) => {
      if (where.name) {
        return await queryOne('SELECT * FROM tags WHERE name = $1', [where.name.toLowerCase()]);
      }
      if (where.id) {
        return await queryOne('SELECT * FROM tags WHERE id = $1', [where.id]);
      }
      return null;
    },

    create: async ({ data }: { data: { name: string } }) => {
      const id = crypto.randomUUID();
      await execute('INSERT INTO tags (id, name) VALUES ($1, $2)', [id, data.name.toLowerCase()]);
      return { id, name: data.name.toLowerCase() };
    }
  },

  storyTag: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      await execute('INSERT INTO story_tags (id, "storyId", "tagId") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, data.storyId, data.tagId]);
    },
    deleteMany: async ({ where }: { where: { storyId: string } }) => {
      await execute('DELETE FROM story_tags WHERE "storyId" = $1', [where.storyId]);
    }
  },

  storyLike: {
    findUnique: async ({ where }: any) => {
      const { userId, storyId } = where.userId_storyId;
      return await queryOne('SELECT * FROM story_likes WHERE "userId" = $1 AND "storyId" = $2', [userId, storyId]);
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO story_likes (id, "userId", "storyId", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [id, data.userId, data.storyId, now]);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await execute('DELETE FROM story_likes WHERE id = $1', [where.id]);
    }
  },

  episodeLike: {
    findUnique: async ({ where }: any) => {
      const { userId, episodeId } = where.userId_episodeId;
      return await queryOne('SELECT * FROM episode_likes WHERE "userId" = $1 AND "episodeId" = $2', [userId, episodeId]);
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO episode_likes (id, "userId", "episodeId", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [id, data.userId, data.episodeId, now]);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await execute('DELETE FROM episode_likes WHERE id = $1', [where.id]);
    }
  },

  storyView: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO story_views (id, "userId", "storyId", "ipAddress", "createdAt") VALUES ($1, $2, $3, $4, $5)', [
        id,
        data.userId || null,
        data.storyId,
        data.ipAddress || null,
        now
      ]);
    }
  },

  episodeView: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO episode_views (id, "userId", "episodeId", "ipAddress", "createdAt") VALUES ($1, $2, $3, $4, $5)', [
        id,
        data.userId || null,
        data.episodeId,
        data.ipAddress || null,
        now
      ]);
    }
  },

  comment: {
    findMany: async ({ where = {} }: any): Promise<any[]> => {
      let sql = 'SELECT * FROM comments WHERE "storyId" = $1';
      const params: any[] = [where.storyId];
      let idx = 2;

      if (where.parentId === null) {
        sql += ' AND "parentId" IS NULL';
      } else if (where.parentId) {
        sql += ` AND "parentId" = $${idx++}`;
        params.push(where.parentId);
      }

      if (where.episodeId) {
        sql += ` AND "episodeId" = $${idx++}`;
        params.push(where.episodeId);
      }

      sql += ' ORDER BY "createdAt" DESC';
      const rows = await query(sql, params);

      return Promise.all(
        rows.map(async (c: any): Promise<any> => {
          const user = await prisma.user.findUnique({ where: { id: c.userId } });
          const likes = await query('SELECT "userId" FROM comment_likes WHERE "commentId" = $1', [c.id]);
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
      const row = await queryOne('SELECT * FROM comments WHERE id = $1', [where.id]);
      if (!row) return null;
      const user = await prisma.user.findUnique({ where: { id: row.userId } });
      const likes = await query('SELECT "userId" FROM comment_likes WHERE "commentId" = $1', [row.id]);
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
      await execute(`
        INSERT INTO comments (id, "storyId", "episodeId", "userId", "parentId", content, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        data.storyId,
        data.episodeId || null,
        data.userId,
        data.parentId || null,
        data.content,
        now,
        now
      ]);
      return prisma.comment.findUnique({ where: { id } });
    }
  },

  commentLike: {
    findUnique: async ({ where }: any) => {
      const { userId, commentId } = where.userId_commentId;
      return await queryOne('SELECT * FROM comment_likes WHERE "userId" = $1 AND "commentId" = $2', [userId, commentId]);
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO comment_likes (id, "userId", "commentId", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [id, data.userId, data.commentId, now]);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await execute('DELETE FROM comment_likes WHERE id = $1', [where.id]);
    },
    count: async ({ where }: { where: { commentId: string } }) => {
      const res = await queryOne('SELECT COUNT(*) as c FROM comment_likes WHERE "commentId" = $1', [where.commentId]);
      return Number(res?.c || 0);
    }
  },

  follow: {
    findUnique: async ({ where }: any) => {
      const { followerId, followingId } = where.followerId_followingId;
      return await queryOne('SELECT * FROM follows WHERE "followerId" = $1 AND "followingId" = $2', [followerId, followingId]);
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO follows (id, "followerId", "followingId", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [id, data.followerId, data.followingId, now]);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await execute('DELETE FROM follows WHERE id = $1', [where.id]);
    },
    findMany: async ({ where }: { where: { followerId: string } }) => {
      return await query('SELECT * FROM follows WHERE "followerId" = $1', [where.followerId]);
    },
    count: async ({ where }: any) => {
      if (where.followingId) {
        const res = await queryOne('SELECT COUNT(*) as c FROM follows WHERE "followingId" = $1', [where.followingId]);
        return Number(res?.c || 0);
      }
      if (where.followerId) {
        const res = await queryOne('SELECT COUNT(*) as c FROM follows WHERE "followerId" = $1', [where.followerId]);
        return Number(res?.c || 0);
      }
      return 0;
    }
  },

  bookmark: {
    findUnique: async ({ where }: any) => {
      const { userId, storyId } = where.userId_storyId;
      return await queryOne('SELECT * FROM bookmarks WHERE "userId" = $1 AND "storyId" = $2', [userId, storyId]);
    },
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute('INSERT INTO bookmarks (id, "userId", "storyId", "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [id, data.userId, data.storyId, now]);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      await execute('DELETE FROM bookmarks WHERE id = $1', [where.id]);
    },
    findMany: async ({ where }: { where: { userId: string } }) => {
      const rows = await query('SELECT "storyId" FROM bookmarks WHERE "userId" = $1 ORDER BY "createdAt" DESC', [where.userId]);
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
      await execute(`
        INSERT INTO reports (id, "reporterId", "storyId", "episodeId", category, priority, status, reason, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
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
      ]);
      return prisma.report.findUnique({ where: { id } });
    },

    findMany: async ({ where = {}, skip = 0, take = 20 }: any = {}) => {
      let sql = 'SELECT * FROM reports WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where.priority) {
        sql += ` AND priority = $${idx++}`;
        params.push(where.priority);
      }
      if (where.status) {
        sql += ` AND status = $${idx++}`;
        params.push(where.status);
      }
      sql += ` ORDER BY CASE WHEN priority = 'HIGH' THEN 0 ELSE 1 END, "createdAt" ASC`;
      sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(take, skip);

      const rows = await query(sql, params);
      return Promise.all(rows.map((r) => prisma.report.findUnique({ where: { id: r.id } })));
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = await queryOne('SELECT * FROM reports WHERE id = $1', [where.id]);
      if (!row) return null;
      const reporter = await prisma.user.findUnique({ where: { id: row.reporterId } });
      const story = await prisma.story.findUnique({ where: { id: row.storyId } });
      const episode = row.episodeId ? await prisma.episode.findUnique({ where: { id: row.episodeId } }) : null;
      const actions = await query('SELECT * FROM moderation_actions WHERE "reportId" = $1', [row.id]);

      return {
        ...row,
        reporter,
        story,
        episode,
        actions
      };
    },

    count: async ({ where = {} }: any = {}) => {
      let sql = 'SELECT COUNT(*) as c FROM reports WHERE 1=1';
      const params: any[] = [];
      let idx = 1;
      if (where.priority) {
        sql += ` AND priority = $${idx++}`;
        params.push(where.priority);
      }
      if (where.status) {
        sql += ` AND status = $${idx++}`;
        params.push(where.status);
      }
      const res = await queryOne(sql, params);
      return Number(res?.c || 0);
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const current = await queryOne('SELECT * FROM reports WHERE id = $1', [where.id]);
      if (!current) throw new Error('Report not found');

      const now = new Date().toISOString();
      const newStatus = data.status || current.status;
      const newNotes = data.moderatorNotes !== undefined ? data.moderatorNotes : current.moderatorNotes;
      const newResolver = data.resolvedById !== undefined ? data.resolvedById : current.resolvedById;
      const newResolvedAt = data.resolvedAt !== undefined ? new Date(data.resolvedAt).toISOString() : current.resolvedAt;

      await execute('UPDATE reports SET status = $1, "moderatorNotes" = $2, "resolvedById" = $3, "resolvedAt" = $4, "updatedAt" = $5 WHERE id = $6', [
        newStatus,
        newNotes,
        newResolver,
        newResolvedAt,
        now,
        where.id
      ]);

      return prisma.report.findUnique({ where: { id: where.id } });
    }
  },

  moderationAction: {
    create: async ({ data }: { data: any }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await execute(`
        INSERT INTO moderation_actions (id, "reportId", "moderatorId", "actionType", "targetType", "targetId", notes, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        data.reportId || null,
        data.moderatorId,
        data.actionType,
        data.targetType,
        data.targetId,
        data.notes,
        now
      ]);
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
