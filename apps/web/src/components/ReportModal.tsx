'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { X, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReportCategory } from '@storybabe/types';

interface ReportModalProps {
  storyId: string;
  storyTitle: string;
  episodeId?: string | null;
  onClose: () => void;
}

export default function ReportModal({ storyId, storyTitle, episodeId, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<ReportCategory>('NO_CONSENT');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to file a report.');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Please provide a specific explanation (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.moderation.fileReport({
        storyId,
        episodeId,
        category,
        reason: reason.trim()
      });

      if (res.success) {
        setSuccessMessage(
          category === 'NO_CONSENT'
            ? 'Report filed successfully. This has been placed in our Priority Review Queue for expedited evaluation.'
            : 'Report submitted. Our safety team will review the content.'
        );
        setTimeout(() => {
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.125rem' }}>Report Content</h3>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Reporting: <strong>{storyTitle}</strong>
        </div>

        {successMessage ? (
          <div
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--status-ongoing-bg)',
              border: '1px solid var(--status-ongoing-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-ongoing-text)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}
          >
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Report Received</div>
              <div style={{ fontSize: '0.875rem' }}>{successMessage}</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--priority-badge-bg)',
                  border: '1px solid var(--priority-badge-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--priority-badge-text)',
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

            {/* Category selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' }}>
                Reason Category
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Priority Option */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: category === 'NO_CONSENT' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: category === 'NO_CONSENT' ? 'var(--accent-subtle)' : 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="NO_CONSENT"
                    checked={category === 'NO_CONSENT'}
                    onChange={() => setCategory('NO_CONSENT')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span>Identifies me or someone without consent</span>
                      <span className="badge badge-priority" style={{ fontSize: '0.6875rem' }}>Priority Review</span>
                    </div>
                    <div style={{ fontSize: '0.78125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Gets immediate priority queue assignment and urgent review.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: category === 'HARASSMENT' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="HARASSMENT"
                    checked={category === 'HARASSMENT'}
                    onChange={() => setCategory('HARASSMENT')}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Harassment, Hate, or Targeted Abuse</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: category === 'COPYRIGHT' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="COPYRIGHT"
                    checked={category === 'COPYRIGHT'}
                    onChange={() => setCategory('COPYRIGHT')}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Plagiarism or Stolen Work</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: category === 'SPAM' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="SPAM"
                    checked={category === 'SPAM'}
                    onChange={() => setCategory('SPAM')}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Commercial Spam or Promotion</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: category === 'OTHER' ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="category"
                    value="OTHER"
                    checked={category === 'OTHER'}
                    onChange={() => setCategory('OTHER')}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Other Issue</span>
                </label>
              </div>
            </div>

            {/* Explanation Details */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' }}>
                Detailed Explanation
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe why this story or episode violates community rules or identifies someone without their consent..."
                className="textarea"
                rows={4}
                required
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-accent" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
