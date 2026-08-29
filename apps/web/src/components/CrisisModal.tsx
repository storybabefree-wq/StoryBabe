'use client';

import React from 'react';
import type { SafetyFlag } from '@storybabe/types';
import { SAFETY_FLAG_INFO, CRISIS_RESOURCES, CRISIS_DISCLAIMER } from '@storybabe/types';
import { X, ShieldAlert, PhoneCall, MessageSquare, HeartHandshake } from 'lucide-react';

interface CrisisModalProps {
  flags?: SafetyFlag[];
  onClose: () => void;
}

export default function CrisisModal({ flags = [], onClose }: CrisisModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--border-subtle)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(225, 29, 72, 0.1)',
                color: '#E11D48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <HeartHandshake size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Crisis Support & Safety Resources
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Free, confidential support available 24/7
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Notice if story has safety flags */}
        {flags.length > 0 && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Author Self-Disclosed Topics
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {flags.map((flag) => (
                <span key={flag} className="badge badge-tag" style={{ fontSize: '0.75rem' }}>
                  {SAFETY_FLAG_INFO[flag]?.label || flag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Platform Disclaimer */}
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
          {CRISIS_DISCLAIMER}
        </p>

        {/* 24/7 Lifelines & Hotlines Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {CRISIS_RESOURCES.map((res) => (
            <div
              key={res.name}
              style={{
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{res.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{res.detail}</div>
              </div>

              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.9375rem',
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap'
                }}
              >
                {res.contact}
              </div>
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', fontWeight: 600 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
