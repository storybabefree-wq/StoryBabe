import React from 'react';
import type { SafetyFlag } from '@storybabe/types';
import { SAFETY_FLAG_INFO, CRISIS_RESOURCES, CRISIS_DISCLAIMER } from '@storybabe/types';
import { AlertTriangle, PhoneCall, MessageSquare, ShieldAlert } from 'lucide-react';

interface SafetyBannerProps {
  flags: SafetyFlag[];
}

export default function SafetyBanner({ flags }: SafetyBannerProps) {
  if (!flags || flags.length === 0) return null;

  return (
    <aside className="safety-resource-banner" aria-label="Crisis Support and Content Notice">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h4>
          <AlertTriangle size={17} />
          <span>Personal Experience Notice & Crisis Resources</span>
        </h4>

        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {flags.map((flag) => (
            <span
              key={flag}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--safety-banner-border)'
              }}
            >
              {SAFETY_FLAG_INFO[flag]?.label || flag}
            </span>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--safety-banner-text)', lineHeight: 1.55 }}>
        {CRISIS_DISCLAIMER}
      </p>

      {/* Direct Crisis Resource Hotlines */}
      <div className="resource-grid" style={{ marginTop: '0.75rem' }}>
        {CRISIS_RESOURCES.slice(0, 4).map((res) => (
          <div key={res.name} className="safety-resource-pill">
            <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{res.name}</div>
            <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.875rem' }}>{res.contact}</div>
            <div style={{ fontSize: '0.71875rem', opacity: 0.85 }}>{res.detail}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
