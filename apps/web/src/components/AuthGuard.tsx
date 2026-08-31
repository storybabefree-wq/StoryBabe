'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  BookOpen,
  PenSquare,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import OtpVerifyModal from './OtpVerifyModal';

type GuardView = 'LOGIN' | 'REGISTER' | 'FORGOT_REQUEST' | 'FORGOT_RESET';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const {
    user,
    isLoading,
    login,
    sendRegisterOtp,
    verifyRegisterOtp,
    sendForgotPasswordOtp,
    resetPassword,
    resendOtp
  } = useAuth();

  const [view, setView] = useState<GuardView>('LOGIN');

  // Sign In Form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Form
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP Popup State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpModalType, setOtpModalType] = useState<'REGISTRATION' | 'PASSWORD_RESET'>('REGISTRATION');
  const [pendingOtpEmail, setPendingOtpEmail] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isSubmittingRef = useRef(false);

  // Reset all forms and sensitive states on logout or user session change
  useEffect(() => {
    if (!user) {
      setLoginPassword('');
      setRegisterPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOtpModal(false);
      setError('');
      setSuccessMessage('');
      setView('LOGIN');
      isSubmittingRef.current = false;
    }
  }, [user]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Authenticating session...
        </span>
      </div>
    );
  }

  // If user is authenticated, render the full app!
  if (user) {
    return <>{children}</>;
  }

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;

    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter both your email/username and password.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      await login(loginIdentifier.trim(), loginPassword);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please check your username/email and password.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Register Step 1: Send OTP & Open Popup Modal
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;
    setError('');
    setSuccessMessage('');

    const cleanDisplay = displayName.trim();
    const cleanUser = username.trim();
    const cleanEmail = email.trim();

    if (!cleanDisplay || !cleanUser || !cleanEmail || !registerPassword) {
      setError('All fields are required.');
      return;
    }

    if (cleanUser.length < 3 || !/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      setError('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
      return;
    }

    if (registerPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(registerPassword)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await sendRegisterOtp({
        displayName: cleanDisplay,
        username: cleanUser,
        email: cleanEmail,
        password: registerPassword
      });

      setPendingOtpEmail(cleanEmail);
      setOtpModalType('REGISTRATION');
      setShowOtpModal(true);
    } catch (err: any) {
      if (err.message && (err.message.includes('already sent') || err.message.includes('COOLDOWN_ACTIVE') || err.message.includes('REQUEST_IN_PROGRESS'))) {
        setPendingOtpEmail(cleanEmail);
        setOtpModalType('REGISTRATION');
        setShowOtpModal(true);
      } else {
        setError(err.message || 'Failed to dispatch verification code.');
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Verify OTP from Popup Modal
  const handleVerifyOtp = async (code: string) => {
    if (otpModalType === 'REGISTRATION') {
      await verifyRegisterOtp({
        email: pendingOtpEmail,
        code
      });
      // Verification succeeded -> wipe form & modal automatically closes
      setRegisterPassword('');
      setShowOtpModal(false);
    } else {
      await resetPassword({
        email: pendingOtpEmail,
        code,
        newPassword
      });
      setShowOtpModal(false);
      setSuccessMessage('Password reset successfully. Please sign in with your new password.');
      setView('LOGIN');
      setLoginIdentifier(pendingOtpEmail);
      setLoginPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // Handle Resend OTP from Popup Modal
  const handleResendOtp = async () => {
    await resendOtp({
      email: pendingOtpEmail,
      type: otpModalType
    });
  };

  // Handle Forgot Password Request
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;
    setError('');

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      setError('Please enter your account email address.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await sendForgotPasswordOtp(cleanEmail);
      setPendingOtpEmail(cleanEmail);
      setView('FORGOT_RESET');
      setSuccessMessage('A 6-digit password reset code was sent to your email.');
    } catch (err: any) {
      if (err.message && (err.message.includes('already sent') || err.message.includes('COOLDOWN_ACTIVE') || err.message.includes('REQUEST_IN_PROGRESS'))) {
        setPendingOtpEmail(cleanEmail);
        setView('FORGOT_RESET');
        setSuccessMessage('A password reset code was already sent to your email.');
      } else {
        setError(err.message || 'Failed to send password reset code.');
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Forgot Password Step 2 -> Open OTP Popup
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      setError('New password must contain at least one letter and one number.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setOtpModalType('PASSWORD_RESET');
    setShowOtpModal(true);
  };

  return (
    <div className="auth-gateway-wrapper">
      {/* Dedicated OTP Verification Popup Modal */}
      {showOtpModal && (
        <OtpVerifyModal
          email={pendingOtpEmail}
          type={otpModalType}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onClose={() => setShowOtpModal(false)}
        />
      )}

      <div className="auth-gateway-card">
        {/* Left: Product Manifesto (Visible on Desktop/Tablet, clean hidden on small mobile) */}
        <div className="auth-manifesto-column">
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
                marginBottom: '0.75rem'
              }}
            >
              <Lock size={13} />
              Private Personal Storytelling
            </span>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                lineHeight: 1.15,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '0.75rem'
              }}
            >
              Real personal experiences. Told by real people.
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              StoryBabe is a private community dedicated to authentic personal experiences and life chapters,
              shared without algorithms, fiction, or sensationalism. Sign in or create an account to start reading and writing.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                <BookOpen size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.125rem' }}>Authentic Voices</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Monologues, multi-part series, and candid life reflections.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  color: '#a855f7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                <PenSquare size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.125rem' }}>Visual Story Studio</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Format your chapters with customized atmospheric posters and styles.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.125rem' }}>Private & Protected</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Your email is strictly private. Identity cooldown rules prevent impersonation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="auth-form-column">
          {/* Tab Navigation */}
          {view === 'LOGIN' || view === 'REGISTER' ? (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setView('LOGIN');
                  setError('');
                  setSuccessMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: view === 'LOGIN' ? 'var(--accent-primary)' : 'transparent',
                  color: view === 'LOGIN' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('REGISTER');
                  setError('');
                  setSuccessMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: view === 'REGISTER' ? 'var(--accent-primary)' : 'transparent',
                  color: view === 'REGISTER' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setView('LOGIN');
                  setError('');
                  setSuccessMessage('');
                }}
                className="btn btn-sm btn-ghost"
                style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {view === 'FORGOT_REQUEST' ? 'Reset Password' : 'Enter New Password'}
              </span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--priority-badge-bg)',
                border: '1px solid var(--priority-badge-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--priority-badge-text)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: '#4ade80',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* VIEW 1: SIGN IN */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="input"
                  autoComplete="username"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('FORGOT_REQUEST');
                      setError('');
                      setSuccessMessage('');
                      setForgotEmail(loginIdentifier.includes('@') ? loginIdentifier : '');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="input"
                    style={{ paddingRight: '2.5rem' }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>{isSubmitting ? 'Signing in...' : 'Sign In to StoryBabe'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 2: REGISTER FORM */}
          {view === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Author display name"
                  className="input"
                  maxLength={50}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Username (Unique handle)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="input"
                  maxLength={30}
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Email (Private verification)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="author@example.com"
                  className="input"
                  autoComplete="email"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Password (Min 8 chars, letter & number)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Create password"
                    className="input"
                    style={{ paddingRight: '2.5rem' }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>{isSubmitting ? 'Sending Verification Code...' : 'Continue & Verify Email'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD REQUEST */}
          {view === 'FORGOT_REQUEST' && (
            <form onSubmit={handleForgotRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Enter the email address registered with your account to receive a 6-digit password reset code.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Account Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="author@example.com"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Sending Reset Code...' : 'Send Reset Code'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 4: FORGOT PASSWORD NEW PASSWORD ENTRY */}
          {view === 'FORGOT_RESET' && (
            <form onSubmit={handleForgotResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  New Password (Min 8 chars, letter & number)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="input"
                    style={{ paddingRight: '2.5rem' }}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Confirm New Password
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>Enter Verification Code</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
