'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import type { ActiveAuthor } from '@storybabe/types';
import { Sparkles, Compass } from 'lucide-react';
import StoryReelModal from './StoryReelModal';

interface ActiveAuthorsTrayProps {
  selectedAuthorId?: string;
  onSelectAuthor?: (authorId: string) => void;
}

export default function ActiveAuthorsTray({ selectedAuthorId, onSelectAuthor }: ActiveAuthorsTrayProps) {
  const [authors, setAuthors] = useState<ActiveAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reelAuthorIndex, setReelAuthorIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchActiveAuthors();
  }, []);

  const fetchActiveAuthors = async () => {
    try {
      const res = await api.stories.getActiveAuthors();
      if (res.success && res.data) {
        setAuthors(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoading && authors.length === 0) {
    return null;
  }

  return (
    <>
      <section
        style={{
          marginBottom: '2rem',
          padding: '1rem 0',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.875rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-secondary)'
              }}
            >
              Active Voices & Storytellers
            </span>
          </div>

          {selectedAuthorId && onSelectAuthor && (
            <button
              onClick={() => onSelectAuthor('')}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              Show All
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            overflowX: 'auto',
            paddingBottom: '0.5rem',
            scrollbarWidth: 'none'
          }}
        >
          {/* All Stories Avatar Circle */}
          <button
            onClick={() => onSelectAuthor && onSelectAuthor('')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.375rem',
              minWidth: '68px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                padding: '2px',
                background: !selectedAuthorId
                  ? 'linear-gradient(135deg, var(--accent-primary) 0%, #818CF8 100%)'
                  : 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform var(--transition-fast)'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: !selectedAuthorId ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <Compass size={22} />
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: !selectedAuthorId ? 700 : 500,
                color: !selectedAuthorId ? 'var(--text-primary)' : 'var(--text-secondary)',
                maxWidth: '68px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              All Feed
            </span>
          </button>

          {/* Storyteller Circles: Click to open Story Reel */}
          {authors.map((author, index) => {
            return (
              <button
                key={author.id}
                onClick={() => setReelAuthorIndex(index)}
                title={`Watch ${author.displayName}'s story reel`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                  minWidth: '68px',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '50%',
                    padding: '2px',
                    background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 50%, #EC4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform var(--transition-fast)'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '2px solid var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      overflow: 'hidden'
                    }}
                  >
                    {author.avatarUrl ? (
                      <img
                        src={author.avatarUrl}
                        alt={author.displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span>{author.displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    maxWidth: '72px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {author.displayName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fullscreen Story Reel Modal */}
      {reelAuthorIndex !== null && (
        <StoryReelModal
          authors={authors}
          initialAuthorIndex={reelAuthorIndex}
          onClose={() => setReelAuthorIndex(null)}
        />
      )}
    </>
  );
}
