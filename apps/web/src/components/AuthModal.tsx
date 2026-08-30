'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, AlertCircle, CheckCircle2, Eye, EyeOff, ArrowRight, ArrowLeft, Mail, Lock, User, RefreshCw, KeyRound } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

type AuthView = 'LOGIN' | 'REGISTER' | 'REGISTER_OTP' | 'FORGOT_REQUEST' | 'FORGOT_RESET';

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

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [devOtpCode, setDevOtpCode] = useState<string | undefined>(undefined);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Feedback state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !loginPassword) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await login(loginInput.trim(), loginPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Step 1: Send OTP
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setIsLoading(true);
    try {
      const res = await sendRegisterOtp({
        displayName: cleanDisplay,
        username: cleanUser,
        email: cleanEmail,
        password
      });

      setDevOtpCode(res.devOtp);
      setCooldownSeconds(60);
      setOtpDigits(['', '', '', '', '', '']);
      setView('REGISTER_OTP');
      setSuccessMessage('A 6-digit verification code was sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Register Step 2: Verify OTP
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = otpDigits.join('').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyRegisterOtp({
        email: email.trim(),
        code
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Step 1: Send Reset Code
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) {
      setError('Please enter your account email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendForgotPasswordOtp(cleanEmail);
      setDevOtpCode(res.devOtp);
      setCooldownSeconds(60);
      setOtpDigits(['', '', '', '', '', '']);
      setView('FORGOT_RESET');
      setSuccessMessage('A 6-digit password reset code was sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Forgot Password Step 2: Reset Password
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = otpDigits.join('').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter the complete 6-digit reset code.');
      return;
    }

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

    setIsLoading(true);
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        code,
        newPassword
      });

      setSuccessMessage('Password reset successfully. You can now sign in.');
      setView('LOGIN');
      setLoginInput(forgotEmail.trim());
      setLoginPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async (type: 'REGISTRATION' | 'PASSWORD_RESET') => {
    if (cooldownSeconds > 0 || isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      const targetEmail = type === 'REGISTRATION' ? email : forgotEmail;
      const res = await resendOtp({
        email: targetEmail.trim(),
        type
      });

      setDevOtpCode(res.devOtp);
      setCooldownSeconds(60);
      setSuccessMessage('A fresh verification code has been dispatched.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6-box OTP input helper
  const handleOtpDigitChange = (index: number, value: string) => {
    // If pasted full 6 digits
    if (value.length > 1) {
      const cleanDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const updated = [...otpDigits];
      cleanDigits.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setOtpDigits(updated);
      const nextIndex = Math.min(cleanDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const singleDigit = value.replace(/\D/g, '');
    const updated = [...otpDigits];
    updated[index] = singleDigit;
    setOtpDigits(updated);

    if (singleDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '2rem', borderRadius: 'var(--radius-lg)' }}
      >
        {/* Top Header & Tab Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          {view === 'LOGIN' || view === 'REGISTER' ? (
            <div style={{ display: 'flex', gap: '1.25rem', borderBottom: '1px solid var(--border-subtle)', width: '100%', paddingBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setView('LOGIN');
                  setError('');
                  setSuccessMessage('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: view === 'LOGIN' ? 700 : 500,
                  color: view === 'LOGIN' ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  paddingBottom: '0.25rem',
                  borderBottom: view === 'LOGIN' ? '2px solid var(--accent-primary)' : 'none'
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
                  background: 'none',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: view === 'REGISTER' ? 700 : 500,
                  color: view === 'REGISTER' ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  paddingBottom: '0.25rem',
                  borderBottom: view === 'REGISTER' ? '2px solid var(--accent-primary)' : 'none'
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
                  if (view === 'REGISTER_OTP') setView('REGISTER');
                  else setView('LOGIN');
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
                {view === 'REGISTER_OTP' ? 'Email Verification' : view === 'FORGOT_REQUEST' ? 'Reset Password' : 'Enter Reset Code'}
              </span>
            </div>
          )}

          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ padding: '0.25rem', marginLeft: '0.5rem' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

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
              marginBottom: '1.25rem',
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
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Development Helper Badge for OTP */}
        {devOtpCode && (view === 'REGISTER_OTP' || view === 'FORGOT_RESET') && (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px dashed rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#93c5fd',
              fontSize: '0.8125rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>Testing Code: <strong>{devOtpCode}</strong></span>
            <button
              type="button"
              onClick={() => {
                const digits = devOtpCode.split('');
                setOtpDigits(digits);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                cursor: 'pointer',
                fontSize: '0.75rem',
                textDecoration: 'underline'
              }}
            >
              Fill Code
            </button>
          </div>
        )}

        {/* VIEW 1: SIGN IN */}
        {view === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Email or Username
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Enter your username or email"
                className="input"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
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
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  required
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
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* VIEW 2: REGISTER FORM */}
        {view === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Author display name"
                className="input"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Username (Unique handle)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="input"
                required
                autoCapitalize="none"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Email (Private verification)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="author@example.com"
                className="input"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Password (Min 8 characters, letter and number)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  minLength={8}
                  required
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
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Sending Verification Code...' : 'Continue & Verify Email'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* VIEW 3: REGISTER OTP VERIFICATION */}
        {view === 'REGISTER_OTP' && (
          <form onSubmit={handleVerifyOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
              We sent a 6-digit verification code to <br />
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
            </div>

            {/* 6 Digit Input Boxes */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  style={{
                    width: '46px',
                    height: '52px',
                    textAlign: 'center',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: digit ? '2px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)'
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700 }}
              disabled={isLoading || otpDigits.join('').length !== 6}
            >
              <span>{isLoading ? 'Verifying...' : 'Verify & Create Account'}</span>
              <ArrowRight size={16} />
            </button>

            {/* Resend Cooldown Action */}
            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={() => handleResendOtp('REGISTRATION')}
                disabled={cooldownSeconds > 0 || isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: cooldownSeconds > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                  fontWeight: 600,
                  cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {cooldownSeconds > 0 ? `Resend code in ${cooldownSeconds}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 4: FORGOT PASSWORD REQUEST */}
        {view === 'FORGOT_REQUEST' && (
          <form onSubmit={handleForgotRequestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
              Enter the email address registered with your account and we will send you a 6-digit verification code to reset your password.
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
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontWeight: 700, marginTop: '0.5rem' }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Sending Reset Code...' : 'Send Reset Code'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* VIEW 5: FORGOT PASSWORD RESET */}
        {view === 'FORGOT_RESET' && (
          <form onSubmit={handleForgotResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '0.5rem' }}>
              Enter the reset code sent to <br />
              <strong style={{ color: 'var(--text-primary)' }}>{forgotEmail}</strong>
            </div>

            {/* 6 Digit Input Boxes */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  style={{
                    width: '46px',
                    height: '50px',
                    textAlign: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-md)',
                    border: digit ? '2px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)'
                  }}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

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
              disabled={isLoading || otpDigits.join('').length !== 6}
            >
              <span>{isLoading ? 'Resetting Password...' : 'Save New Password & Sign In'}</span>
              <ArrowRight size={16} />
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Didn't receive code?{' '}
              <button
                type="button"
                onClick={() => handleResendOtp('PASSWORD_RESET')}
                disabled={cooldownSeconds > 0 || isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: cooldownSeconds > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                  fontWeight: 600,
                  cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {cooldownSeconds > 0 ? `Resend code in ${cooldownSeconds}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
