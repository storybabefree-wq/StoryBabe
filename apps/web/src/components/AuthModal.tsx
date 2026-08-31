'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import OtpVerifyModal from './OtpVerifyModal';

interface AuthModalProps {
  onClose: () => void;
}

type AuthView = 'LOGIN' | 'REGISTER' | 'FORGOT_REQUEST' | 'FORGOT_RESET';

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, sendRegisterOtp, verifyRegisterOtp, sendForgotPasswordOtp, resetPassword, resendOtp } = useAuth();
  const [view, setView] = useState<AuthView>('LOGIN');

  // Login form state
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // OTP Popup State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpModalType, setOtpModalType] = useState<'REGISTRATION' | 'PASSWORD_RESET'>('REGISTRATION');
  const [pendingOtpEmail, setPendingOtpEmail] = useState('');

  // Feedback state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isSubmittingRef = useRef(false);

  // Clear all states when closing
  const handleModalClose = () => {
    setLoginPassword('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOtpModal(false);
    isSubmittingRef.current = false;
    onClose();
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;

    if (!loginInput.trim() || !loginPassword) {
      setError('Please enter both your email/username and password.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    setError('');
    try {
      await login(loginInput.trim(), loginPassword);
      handleModalClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Register Step 1: Send OTP & Open Popup Modal
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;
    setError('');

    const cleanDisplay = displayName.trim();
    const cleanUser = username.trim();
    const cleanEmail = email.trim();

    if (!cleanDisplay || !cleanUser || !cleanEmail || !password) {
      setError('All fields are required.');
      return;
    }

    if (cleanUser.length < 3 || !/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      setError('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      await sendRegisterOtp({
        displayName: cleanDisplay,
        username: cleanUser,
        email: cleanEmail,
        password
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
      setIsLoading(false);
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
      setPassword('');
      setShowOtpModal(false);
      onClose();
    } else {
      await resetPassword({
        email: pendingOtpEmail,
        code,
        newPassword
      });
      setShowOtpModal(false);
      setSuccessMessage('Password reset successfully. Please sign in with your new password.');
      setView('LOGIN');
      setLoginInput(pendingOtpEmail);
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

  // Handle Forgot Password Step 1: Send Reset Code
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;
    setError('');

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      setError('Please enter your account email address.');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
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
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Forgot Password Step 2: Open OTP Popup
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
    <>
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

      <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={handleModalClose}>
        <div
          className="modal-content"
          style={{ maxWidth: '440px', width: '95vw', padding: '1.75rem 1.5rem', position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            {view === 'LOGIN' || view === 'REGISTER' ? (
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', paddingRight: '2rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setView('LOGIN');
                    setError('');
                    setSuccessMessage('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: view === 'LOGIN' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
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
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: view === 'REGISTER' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
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
                  {view === 'FORGOT_REQUEST' ? 'Reset Password' : 'New Password'}
                </span>
              </div>
            )}

            <button
              onClick={handleModalClose}
              aria-label="Close modal"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '0.625rem 0.875rem',
                backgroundColor: 'var(--priority-badge-bg)',
                border: '1px solid var(--priority-badge-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--priority-badge-text)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div
              style={{
                padding: '0.625rem 0.875rem',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: '#4ade80',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* VIEW 1: SIGN IN */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Email or Username
                </label>
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Enter username or email"
                  className="input"
                  autoComplete="username"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setView('FORGOT_REQUEST');
                      setError('');
                      setSuccessMessage('');
                      setForgotEmail(loginInput.includes('@') ? loginInput : '');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
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
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 2: REGISTER */}
          {view === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>{isLoading ? 'Sending Code...' : 'Continue & Verify Email'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD REQUEST */}
          {view === 'FORGOT_REQUEST' && (
            <form onSubmit={handleForgotRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p style={{ fontSize: '0.84375rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Enter your account email to receive a 6-digit password reset code.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
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
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
                disabled={isLoading}
              >
                <span>{isLoading ? 'Sending...' : 'Send Reset Code'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* VIEW 4: FORGOT PASSWORD SET NEW PASSWORD */}
          {view === 'FORGOT_RESET' && (
            <form onSubmit={handleForgotResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              >
                <span>Enter Verification Code</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
