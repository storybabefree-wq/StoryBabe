'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, AlertCircle, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [isLoginTab, setIsLoginTab] = useState(true);

  // Login form
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim() || !loginPassword) {
      setError('Please enter both your username/email and password.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await login(loginInput, loginPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }

    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await register({
        email,
        username,
        displayName,
        password
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', width: '100%', paddingBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setIsLoginTab(true);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1rem',
                fontWeight: isLoginTab ? 700 : 500,
                color: isLoginTab ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                paddingBottom: '0.25rem',
                borderBottom: isLoginTab ? '2px solid var(--accent-primary)' : 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginTab(false);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1rem',
                fontWeight: !isLoginTab ? 700 : 500,
                color: !isLoginTab ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                paddingBottom: '0.25rem',
                borderBottom: !isLoginTab ? '2px solid var(--accent-primary)' : 'none'
              }}
            >
              Create Account
            </button>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ padding: '0.25rem', marginLeft: '0.5rem' }}>
            <X size={18} />
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
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {isLoginTab ? (
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
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
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
        ) : (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Elena Vance"
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
                placeholder="e.g. elena_v"
                className="input"
                required
                autoCapitalize="none"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Email (Private)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Password (Min 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  minLength={6}
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
              <span>{isLoading ? 'Creating Account...' : 'Create Account'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
