import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  prisma,
  formatAuthUser,
  formatUserProfile
} from '@storybabe/database';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  getUserContext,
  requireAuth,
  registerSchema,
  loginSchema,
  updateUsernameSchema,
  updateProfileSchema
} from '@storybabe/security';
import type { AuthResponse, UserRole } from '@storybabe/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

// Register
app.post('/register', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    const { email, username, displayName, password } = parseResult.data;

    // Check unique email and username
    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' }
      });
      return;
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: 'This username is already taken' }
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        role: 'AUTHOR',
        usernameChangesCount: 0
      }
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      email: user.email
    });

    const responseData: AuthResponse = {
      user: formatAuthUser(user),
      tokens: {
        accessToken,
        refreshToken: accessToken,
        expiresIn: 604800
      }
    };

    res.status(201).json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create user account' }
    });
  }
});

// Login
app.post('/login', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { emailOrUsername, password } = parseResult.data;
    const lowerInput = emailOrUsername.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: lowerInput }, { username: lowerInput }]
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/username or password' }
      });
      return;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/username or password' }
      });
      return;
    }

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
      email: user.email
    });

    const responseData: AuthResponse = {
      user: formatAuthUser(user),
      tokens: {
        accessToken,
        refreshToken: accessToken,
        expiresIn: 604800
      }
    };

    res.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Authentication failed' }
    });
  }
});

// Get Me (Authenticated)
app.get('/me', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
      return;
    }

    res.json({ success: true, data: formatAuthUser(user) });
  } catch (error: any) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve current user' }
    });
  }
});

// Update Username (Rule: 1 free change, then 30-day cooldown)
app.put('/username', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const parseResult = updateUsernameSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const newUsername = parseResult.data.username.toLowerCase();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
      return;
    }

    if (user.username === newUsername) {
      res.status(400).json({
        success: false,
        error: { code: 'SAME_USERNAME', message: 'New username must be different from current username' }
      });
      return;
    }

    // Cooldown check
    const now = new Date();
    if (user.usernameChangesCount > 0 && user.lastUsernameChangeAt) {
      const lastChange = new Date(user.lastUsernameChangeAt);
      const diffMs = now.getTime() - lastChange.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 30) {
        const remainingDays = 30 - diffDays;
        res.status(400).json({
          success: false,
          error: {
            code: 'USERNAME_COOLDOWN_ACTIVE',
            message: `You cannot change your username yet. 30-day cooldown active (${remainingDays} days remaining).`
          }
        });
        return;
      }
    }

    // Unique check
    const existing = await prisma.user.findUnique({ where: { username: newUsername } });
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: 'This username is already taken' }
      });
      return;
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.usernameHistory.create({
        data: {
          userId: user.id,
          oldUsername: user.username,
          newUsername: newUsername
        }
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          username: newUsername,
          lastUsernameChangeAt: now.toISOString(),
          usernameChangesCount: { increment: 1 }
        }
      });
    });

    res.json({
      success: true,
      data: formatAuthUser(updatedUser),
      message: 'Username successfully changed'
    });
  } catch (error: any) {
    console.error('Update username error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update username' }
    });
  }
});

// Update Profile (Display name changeable anytime, bio, avatar)
app.put('/profile', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { displayName, bio, avatarUrl } = parseResult.data;

    const updatedUser = await prisma.user.update({
      where: { id: userId! },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      }
    });

    res.json({ success: true, data: formatAuthUser(updatedUser) });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update profile' }
    });
  }
});

// Public Author Profile by Username (Never exposes private email)
app.get('/users/:username', async (req: any, res: any): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Author not found' }
      });
      return;
    }

    res.json({ success: true, data: formatUserProfile(user) });
  } catch (error: any) {
    console.error('Get author error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve author profile' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`StoryBabe Auth Service running on port ${PORT}`);
});
