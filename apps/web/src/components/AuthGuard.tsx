'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Lock,
  BookOpen,
  PenSquare,
  Users,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // If user is NOT authenticated, display the mandatory Authentication Gateway
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setError('Please enter both your username/email and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(loginIdentifier, loginPassword);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim() || !email.trim() || !registerPassword) {
      setError('All fields are required to create an account.');
      return;
    }

    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
      return;
    }

    if (registerPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await register({
        displayName,
        username,
        email,
        password: registerPassword
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: '3rem',
          alignItems: 'center'
        }}
      >
        {/* Left Column: Atmospheric Brand & Philosophy */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--accent-primary)',
              marginBottom: '1rem'
            }}
          >
            <Sparkles size={14} />
            <span>Private Personal Storytelling</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.75rem',
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
              color: 'var(--text-primary)'
            }}
          >
            Real personal experiences. Told by real people.
          </h1>

          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              marginBottom: '2rem'
            }}
          >
            StoryBabe is a private community where authentic lives are shared without algorithms, fiction, or performance. Sign in or create an account to start reading and sharing.
          </p>

          {/* Pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <BookOpen size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Authentic Voices</strong>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Read genuine one-shots and multi-part series across grief, growth, career, and transitions.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <PenSquare size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Visual Story Studio</strong>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Publish your chapters with atmospheric poster cards and punchy oneliner quotes.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Private & Protected</strong>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Your email is strictly private. Identity cooldown rules prevent impersonation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Sign In / Create Account Portal */}
        <div
          className="card"
          style={{
            padding: '2.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-modal)'
          }}
        >
          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.75rem'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`btn btn-sm ${activeTab === 'login' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontWeight: activeTab === 'login' ? 700 : 500 }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError('');
              }}
              className={`btn btn-sm ${activeTab === 'register' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontWeight: activeTab === 'register' ? 700 : 500 }}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--priority-badge-bg)',
                border: '1px solid var(--priority-badge-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--priority-badge-text)',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            /* Sign In Form */
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Enter your username or email"
                  className="input"
                  autoComplete="username"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
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
          ) : (
            /* Create Account Form */
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Display Name (Changeable anytime)
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Elena Vance"
                  className="input"
                  maxLength={50}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Username (Unique handle)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. elena_v"
                  className="input"
                  maxLength={30}
                  autoCapitalize="none"
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  1 free change included, then 30-day cooldown applies.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Private Email (Auth only)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input"
                  autoComplete="email"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Password (Min 6 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Create a strong password"
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
                <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
