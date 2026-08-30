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
  generateOtpCode,
  sendRegisterOtpSchema,
  verifyRegisterOtpSchema,
  sendForgotPasswordOtpSchema,
  resetPasswordOtpSchema,
  resendOtpSchema,
  registerSchema,
  loginSchema,
  updateUsernameSchema,
  updateProfileSchema
} from '@storybabe/security';
import type { AuthResponse, UserRole } from '@storybabe/types';
import { sendOtpEmail } from './email';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

/**
 * Step 1: Send Registration OTP
 * Validates signup inputs, checks duplicates, generates 6-digit OTP, stores pending payload, and sends verification email.
 */
app.post('/register/send-otp', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = sendRegisterOtpSchema.safeParse(req.body);
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
    const lowerEmail = email.toLowerCase().trim();
    const lowerUsername = username.toLowerCase().trim();

    // Check unique email and username
    const existingEmail = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
      });
      return;
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: lowerUsername } });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: 'This username is already taken. Please choose another.' }
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Delete prior pending registration OTPs for this email
    await prisma.otpVerification.deleteMany({
      where: { email: lowerEmail, type: 'REGISTRATION' }
    });

    const payload = JSON.stringify({
      username: lowerUsername,
      displayName: displayName.trim(),
      passwordHash
    });

    await prisma.otpVerification.create({
      data: {
        email: lowerEmail,
        code,
        type: 'REGISTRATION',
        payload,
        expiresAt,
        attempts: 0,
        verified: false
      }
    });

    // Send Email
    const emailResult = await sendOtpEmail({
      to: lowerEmail,
      code,
      type: 'REGISTRATION',
      displayName
    });

    res.status(200).json({
      success: true,
      data: {
        email: lowerEmail,
        expiresInSeconds: 600,
        devOtp: isDev && !process.env.RESEND_API_KEY ? code : undefined,
        message: 'A 6-digit verification code has been sent to your email.'
      }
    });
  } catch (error: any) {
    console.error('Send Register OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to send verification code. Please try again.' }
    });
  }
});

/**
 * Step 2: Verify Registration OTP & Create User
 * Validates OTP code, marks as verified, creates the user in the database, and issues session tokens.
 */
app.post('/register/verify-otp', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = verifyRegisterOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { email, code } = parseResult.data;
    const lowerEmail = email.toLowerCase().trim();

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: lowerEmail, type: 'REGISTRATION', verified: false }
    });

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'No active verification code found. Please request a new code.' }
      });
      return;
    }

    // Check expiration
    if (new Date() > new Date(otpRecord.expiresAt)) {
      res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'The verification code has expired. Please request a new code.' }
      });
      return;
    }

    // Check attempt limit
    if (otpRecord.attempts >= 5) {
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new code.' }
      });
      return;
    }

    // Check code matching
    if (otpRecord.code !== code.trim()) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      const remaining = 4 - otpRecord.attempts;
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: remaining > 0 ? `Incorrect verification code. ${remaining} attempts remaining.` : 'Incorrect verification code.'
        }
      });
      return;
    }

    // Parse pending registration data
    let signupData: any = {};
    try {
      signupData = JSON.parse(otpRecord.payload || '{}');
    } catch {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Corrupted registration data. Please restart registration.' }
      });
      return;
    }

    // Check if email or username got registered in the meantime
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: lowerEmail }, { username: signupData.username }]
      }
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email or username already exists.' }
      });
      return;
    }

    // Mark OTP verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true }
    });

    const nowIso = new Date().toISOString();
    const user = await prisma.user.create({
      data: {
        email: lowerEmail,
        username: signupData.username,
        displayName: signupData.displayName,
        passwordHash: signupData.passwordHash,
        role: 'AUTHOR',
        emailVerified: true,
        emailVerifiedAt: nowIso,
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
    console.error('Verify Register OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to verify code and complete registration.' }
    });
  }
});

/**
 * Step 3: Send Password Reset OTP
 * Finds user, generates 6-digit reset code, and emails user.
 */
app.post('/forgot-password/send-otp', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = sendForgotPasswordOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const lowerEmail = parseResult.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });

    if (!user) {
      // Don't reveal user existence for security, or return clear message
      res.status(200).json({
        success: true,
        data: {
          email: lowerEmail,
          expiresInSeconds: 600,
          message: 'If an account with this email exists, a password reset code has been sent.'
        }
      });
      return;
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await prisma.otpVerification.deleteMany({
      where: { email: lowerEmail, type: 'PASSWORD_RESET' }
    });

    await prisma.otpVerification.create({
      data: {
        email: lowerEmail,
        code,
        type: 'PASSWORD_RESET',
        expiresAt,
        attempts: 0,
        verified: false
      }
    });

    const emailResult = await sendOtpEmail({
      to: lowerEmail,
      code,
      type: 'PASSWORD_RESET',
      displayName: user.displayName
    });

    res.status(200).json({
      success: true,
      data: {
        email: lowerEmail,
        expiresInSeconds: 600,
        devOtp: isDev && !process.env.RESEND_API_KEY ? code : undefined,
        message: 'A password reset code has been sent to your email.'
      }
    });
  } catch (error: any) {
    console.error('Send Forgot Password OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to send password reset code.' }
    });
  }
});

/**
 * Step 4: Verify Password Reset OTP and Update Password
 */
app.post('/forgot-password/reset', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = resetPasswordOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { email, code, newPassword } = parseResult.data;
    const lowerEmail = email.toLowerCase().trim();

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: lowerEmail, type: 'PASSWORD_RESET', verified: false }
    });

    if (!otpRecord) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OTP', message: 'No active password reset code found. Please request a new code.' }
      });
      return;
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      res.status(400).json({
        success: false,
        error: { code: 'OTP_EXPIRED', message: 'The reset code has expired. Please request a new code.' }
      });
      return;
    }

    if (otpRecord.attempts >= 5) {
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new reset code.' }
      });
      return;
    }

    if (otpRecord.code !== code.trim()) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      const remaining = 4 - otpRecord.attempts;
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: remaining > 0 ? `Incorrect reset code. ${remaining} attempts remaining.` : 'Incorrect reset code.'
        }
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' }
      });
      return;
    }

    // Hash new password and update user
    const passwordHash = await hashPassword(newPassword);

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt || new Date().toISOString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password successfully reset. You can now sign in with your new password.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to reset password.' }
    });
  }
});

/**
 * Resend OTP with cooldown
 */
app.post('/resend-otp', async (req: any, res: any): Promise<void> => {
  try {
    const parseResult = resendOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { email, type } = parseResult.data;
    const lowerEmail = email.toLowerCase().trim();

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { email: lowerEmail, type, verified: false }
    });

    if (existingOtp) {
      const createdTime = new Date(existingOtp.createdAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - createdTime) / 1000);
      if (elapsedSeconds < 60) {
        const remainingSeconds = 60 - elapsedSeconds;
        res.status(429).json({
          success: false,
          error: {
            code: 'COOLDOWN_ACTIVE',
            message: `Please wait ${remainingSeconds} seconds before requesting another code.`
          }
        });
        return;
      }
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await prisma.otpVerification.deleteMany({
      where: { email: lowerEmail, type }
    });

    await prisma.otpVerification.create({
      data: {
        email: lowerEmail,
        code,
        type,
        payload: existingOtp?.payload || null,
        expiresAt,
        attempts: 0,
        verified: false
      }
    });

    const emailResult = await sendOtpEmail({
      to: lowerEmail,
      code,
      type
    });

    res.status(200).json({
      success: true,
      data: {
        email: lowerEmail,
        expiresInSeconds: 600,
        devOtp: isDev && !process.env.RESEND_API_KEY ? code : undefined,
        message: 'A new verification code has been sent to your email.'
      }
    });
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to resend code.' }
    });
  }
});

// Legacy direct register endpoint (fallback)
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
    const lowerEmail = email.toLowerCase().trim();
    const lowerUsername = username.toLowerCase().trim();

    const existingEmail = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existingEmail) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
      });
      return;
    }

    const existingUsername = await prisma.user.findUnique({ where: { username: lowerUsername } });
    if (existingUsername) {
      res.status(409).json({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: 'This username is already taken.' }
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const user = await prisma.user.create({
      data: {
        email: lowerEmail,
        username: lowerUsername,
        displayName: displayName.trim(),
        passwordHash,
        role: 'AUTHOR',
        emailVerified: true,
        emailVerifiedAt: nowIso,
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
    console.error('Direct register error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create user account.' }
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
    const lowerInput = emailOrUsername.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: lowerInput }, { username: lowerInput }]
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/username or password.' }
      });
      return;
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email/username or password.' }
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
      error: { code: 'SERVER_ERROR', message: 'Authentication failed. Please try again.' }
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
        error: { code: 'NOT_FOUND', message: 'User not found.' }
      });
      return;
    }

    res.json({ success: true, data: formatAuthUser(user) });
  } catch (error: any) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve current user.' }
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

    const newUsername = parseResult.data.username.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found.' }
      });
      return;
    }

    if (user.username === newUsername) {
      res.status(400).json({
        success: false,
        error: { code: 'SAME_USERNAME', message: 'New username must be different from current username.' }
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
        error: { code: 'USERNAME_TAKEN', message: 'This username is already taken.' }
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
      message: 'Username successfully changed.'
    });
  } catch (error: any) {
    console.error('Update username error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update username.' }
    });
  }
});

// Update Profile
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
        ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      }
    });

    res.json({ success: true, data: formatAuthUser(updatedUser) });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update profile.' }
    });
  }
});

// Public Author Profile by Username
app.get('/users/:username', async (req: any, res: any): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Author not found.' }
      });
      return;
    }

    res.json({ success: true, data: formatUserProfile(user) });
  } catch (error: any) {
    console.error('Get author error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve author profile.' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`StoryBabe Auth Service running on port ${PORT}`);
});
