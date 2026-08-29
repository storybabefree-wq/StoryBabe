'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { X, Sparkles, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface UsernameModalProps {
  onClose: () => void;
}

export default function UsernameModal({ onClose }: UsernameModalProps) {
  const { user, refreshUser } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || newUsername.toLowerCase() === user.username.toLowerCase()) {
      setError('Please enter a new username different from your current one.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.auth.updateUsername(newUsername.trim());
      if (res.success) {
        setSuccess('Username successfully updated!');
        await refreshUser();
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update username.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.125rem' }}>Username & Identity</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        {/* Current username and status badge */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.25rem'
          }}
        >
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Current Username
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            @{user.username}
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Changes made: <strong>{user.usernameChangesCount}</strong>
          </div>
        </div>

        {/* Rules and Eligibility Notice */}
        {user.canChangeUsername ? (
          <div
            style={{
              padding: '0.875rem',
              backgroundColor: 'var(--status-ongoing-bg)',
              border: '1px solid var(--status-ongoing-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-ongoing-text)',
              fontSize: '0.84375rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}
          >
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              {user.usernameChangesCount === 0 ? (
                <span>
                  <strong>1 Free Username Change Available.</strong> You can change your username now. Any subsequent changes will require a 30-day cooldown period.
                </span>
              ) : (
                <span>
                  <strong>Eligible to Change.</strong> 30 days have passed since your previous username update.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '0.875rem',
              backgroundColor: 'var(--status-onhold-bg)',
              border: '1px solid var(--status-onhold-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-onhold-text)',
              fontSize: '0.84375rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem'
            }}
          >
            <Clock size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>30-Day Cooldown Active.</strong> You recently changed your username. You will be able to update your username again in{' '}
              <strong>{user.daysUntilNextUsernameChange} days</strong>.
            </div>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--status-ongoing-bg)',
              color: 'var(--status-ongoing-text)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--priority-badge-bg)',
              color: 'var(--priority-badge-text)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              New Unique Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. elena_writes"
              className="input"
              disabled={!user.canChangeUsername || isLoading}
              required
            />
            <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)' }}>
              Can only contain letters, numbers, and underscores. Display name is separate and can be changed anytime.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!user.canChangeUsername || isLoading}
            >
              {isLoading ? 'Updating...' : 'Save New Username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
