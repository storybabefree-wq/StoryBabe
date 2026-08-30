'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, RefreshCw, X } from 'lucide-react';

interface OtpVerifyModalProps {
  email: string;
  type: 'REGISTRATION' | 'PASSWORD_RESET';
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClose: () => void;
  devOtp?: string;
}

export default function OtpVerifyModal({
  email,
  type,
  onVerify,
  onResend,
  onClose,
  devOtp
}: OtpVerifyModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60s cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Clean up all state on unmount
  useEffect(() => {
    return () => {
      setDigits(['', '', '', '', '', '']);
      setError('');
      setIsSuccess(false);
    };
  }, []);

  const handleDigitChange = (index: number, val: string) => {
    if (val.length > 1) {
      const clean = val.replace(/\D/g, '').slice(0, 6).split('');
      const updated = ['', '', '', '', '', ''];
      clean.forEach((d, i) => {
        if (i < 6) updated[i] = d;
      });
      setDigits(updated);
      const nextIdx = Math.min(clean.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const single = val.replace(/\D/g, '');
    const updated = [...digits];
    updated[index] = single;
    setDigits(updated);

    if (single && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = digits.join('').trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onVerify(code);
      // Show clean verification success message and purge code from memory
      setIsSuccess(true);
      setDigits(['', '', '', '', '', '']); // WIPE DIGITS
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
      setIsSubmitting(false);
    }
  };

  const handleResendClick = async () => {
    if (cooldownSeconds > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await onResend();
      setCooldownSeconds(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '440px',
          width: '95vw',
          padding: '2rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {!isSuccess && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            <X size={20} />
          </button>
        )}

        {isSuccess ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: '1.5rem 0'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'scaleUp 0.3s ease'
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {type === 'REGISTRATION' ? 'Account Verified Successfully!' : 'Password Reset Verified!'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Welcome to StoryBabe. Entering your workspace...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              <ShieldCheck size={28} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
                Verify Your Email
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                We sent a 6-digit verification code to <br />
                <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{email}</strong>
              </p>
            </div>

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
                  textAlign: 'left'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* 6 Responsive OTP Boxes */}
            <div className="otp-boxes-container">
              {digits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={d}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className={`otp-box-input ${d ? 'filled' : ''}`}
                  autoFocus={idx === 0}
                  disabled={isSubmitting}
                />
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontWeight: 700 }}
              disabled={isSubmitting || digits.join('').length !== 6}
            >
              <span>{isSubmitting ? 'Verifying Code...' : 'Verify & Continue'}</span>
              <ArrowRight size={16} />
            </button>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Didn't receive code?{' '}
              <button
                type="button"
                onClick={handleResendClick}
                disabled={cooldownSeconds > 0 || isSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: cooldownSeconds > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                  fontWeight: 600,
                  cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
