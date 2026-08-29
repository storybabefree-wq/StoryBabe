import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { UserRole, SafetyFlag } from '@storybabe/types';

export const JWT_SECRET = process.env.JWT_SECRET || 'storybabe-production-secure-jwt-secret-key-2026';
export const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'storybabe-internal-microservice-signature-secret-xyz987';

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Internal Service Authentication Middleware
export function verifyInternalSecret(req: any, res: any, next: any): void {
  const incomingSecret = req.headers['x-internal-secret'] as string | undefined;
  if (!incomingSecret || incomingSecret !== INTERNAL_SERVICE_SECRET) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Unauthorized internal service request' }
    });
    return;
  }
  next();
}

// User Context Extraction
export function getUserContext(req: any): {
  userId?: string;
  username?: string;
  role?: UserRole;
} {
  const userId = (req.headers['x-user-id'] as string) || undefined;
  const username = (req.headers['x-user-username'] as string) || undefined;
  const role = (req.headers['x-user-role'] as UserRole) || undefined;
  return { userId, username, role };
}

// Auth Required Guard
export function requireAuth(req: any, res: any, next: any): void {
  const { userId } = getUserContext(req);
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required for this endpoint' }
    });
    return;
  }
  next();
}

// Role Guard (e.g. MODERATOR, ADMIN)
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: any, res: any, next: any): void => {
    const { userId, role } = getUserContext(req);
    if (!userId || !role || !allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' }
      });
      return;
    }
    next();
  };
}

// Zod Validation Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z
    .string()
    .min(1, 'Display name cannot be empty')
    .max(50, 'Display name cannot exceed 50 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required')
});

export const updateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable()
});

const safetyFlagsEnum = z.enum([
  'SELF_HARM',
  'ABUSE',
  'DEATH_LOSS',
  'SUBSTANCE_USE',
  'MENTAL_HEALTH_CRISIS'
]);

export const createStorySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150, 'Title too long'),
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(500, 'Summary too long'),
  oneliner: z.string().max(160, 'Oneliner hook too long').optional().nullable(),
  posterUrl: z.string().optional().nullable(),
  posterStyle: z.enum(['bottom-gradient', 'center-spotlight', 'top-minimal']).default('bottom-gradient'),
  posterType: z.enum(['AI', 'UPLOAD', 'PRESET', 'MINIMAL']).default('PRESET'),
  content: z.string().optional(),
  type: z.enum(['SINGLE', 'SERIES']),
  status: z.enum(['ONGOING', 'COMPLETED', 'ON_HOLD']).default('ONGOING'),
  onHoldReason: z.string().max(200).optional().nullable(),
  allowComments: z.boolean().default(true),
  safetyFlags: z.array(safetyFlagsEnum).default([]),
  tags: z.array(z.string()).default([])
});

export const updateStorySchema = z.object({
  title: z.string().min(3).max(150).optional(),
  summary: z.string().min(10).max(500).optional(),
  oneliner: z.string().max(160).optional().nullable(),
  posterUrl: z.string().optional().nullable(),
  posterStyle: z.enum(['bottom-gradient', 'center-spotlight', 'top-minimal']).optional(),
  posterType: z.enum(['AI', 'UPLOAD', 'PRESET', 'MINIMAL']).optional(),
  content: z.string().optional(),
  status: z.enum(['ONGOING', 'COMPLETED', 'ON_HOLD']).optional(),
  onHoldReason: z.string().max(200).optional().nullable(),
  allowComments: z.boolean().optional(),
  safetyFlags: z.array(safetyFlagsEnum).optional(),
  tags: z.array(z.string()).optional()
});

export const createEpisodeSchema = z.object({
  seasonNumber: z.number().int().min(1).default(1),
  episodeNumber: z.number().int().min(1),
  title: z.string().min(2, 'Episode title required').max(150),
  content: z.string().min(20, 'Episode content must be at least 20 characters'),
  status: z.enum(['DRAFT', 'ONGOING', 'COMPLETED', 'ON_HOLD']).default('COMPLETED'),
  onHoldReason: z.string().max(200).optional().nullable()
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1500, 'Comment exceeds 1500 characters'),
  episodeId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable()
});

export const createReportSchema = z.object({
  storyId: z.string().min(1),
  episodeId: z.string().optional().nullable(),
  category: z.enum(['NO_CONSENT', 'HARASSMENT', 'SPAM', 'COPYRIGHT', 'OTHER']),
  reason: z.string().min(10, 'Please provide a clear explanation for the report').max(1000)
});

export const moderationActionSchema = z.object({
  reportId: z.string().optional().nullable(),
  actionType: z.enum(['WARNING', 'UNPUBLISH', 'RESTRICT_USER', 'DISMISS']),
  targetType: z.enum(['STORY', 'EPISODE', 'USER', 'COMMENT']),
  targetId: z.string().min(1),
  notes: z.string().min(5, 'Moderator notes required')
});
