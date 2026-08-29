import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HeartHandshake } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-secondary)',
        padding: '3rem 1.25rem 2.5rem',
        marginTop: 'auto'
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2rem'
        }}
      >
        {/* Ethos Column */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: 'var(--text-primary)'
            }}
          >
            StoryBabe
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            A space where people post real personal experiences as text stories. Not fiction, not advice, not performance. Real voices speaking for themselves.
          </p>
        </div>

        {/* Safety & Moderation Principles */}
        <div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.75rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            <ShieldCheck size={16} />
            <span>Safety & Human Boundaries</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Mandatory safety flags provide direct crisis support lines on sensitive content. Any story that identifies someone without consent is routed immediately to our prioritized review queue.
          </p>
        </div>

        {/* Crisis Resource Statement */}
        <div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.75rem',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}
          >
            <HeartHandshake size={16} />
            <span>Crisis Support Lines</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            StoryBabe is not an emergency or mental health intervention service. If you are experiencing distress, call or text <strong>988</strong> (US/CA) or text HOME to <strong>741741</strong>.
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)'
        }}
      >
        <div>© {new Date().getFullYear()} StoryBabe. All rights reserved. Real human experiences.</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-secondary)' }}>Home Feed</Link>
          <Link href="/new-story" style={{ color: 'var(--text-secondary)' }}>Write a Story</Link>
          <Link href="/moderation" style={{ color: 'var(--text-secondary)' }}>Safety Desk</Link>
        </div>
      </div>
    </footer>
  );
}
