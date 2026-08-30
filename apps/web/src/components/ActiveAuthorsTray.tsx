'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ActiveAuthor } from '@storybabe/types';
import { Sparkles, Compass, Flame } from 'lucide-react';
import StoryReelModal from './StoryReelModal';

interface ActiveAuthorsTrayProps {
  selectedAuthorId?: string;
  onSelectAuthor?: (authorId: string) => void;
}

const DEFAULT_AUTHORS: ActiveAuthor[] = [
  {
    id: 'author-1',
    username: 'elena_writes',
    displayName: 'Elena Vance',
    avatarUrl: null,
    latestStoryId: 'showcase-1',
    latestStoryTitle: 'The 4:00 AM Decision'
  },
  {
    id: 'author-2',
    username: 'marcus_reid',
    displayName: 'Marcus Reid',
    avatarUrl: null,
    latestStoryId: 'showcase-2',
    latestStoryTitle: 'Leaving the Familiar Coast'
  },
  {
    id: 'author-3',
    username: 'sarah_chen',
    displayName: 'Sarah Chen',
    avatarUrl: null,
    latestStoryId: 'showcase-3',
    latestStoryTitle: 'Letters to My Twenty-Year-Old Self'
  }
];

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
      if (res.success && res.data && res.data.length > 0) {
        setAuthors(res.data);
      } else {
        setAuthors(DEFAULT_AUTHORS);
      }
    } catch {
      setAuthors(DEFAULT_AUTHORS);
    } finally {
      setIsLoading(false);
    }
  };

  const displayAuthors = authors.length > 0 ? authors : DEFAULT_AUTHORS;

  return (
    <>
      <section
        style={{
          marginBottom: '1.75rem',
          padding: '0.75rem 0 1.25rem',
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
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)'
              }}
            >
              Storytellers & Voices
            </span>
          </div>

          {selectedAuthorId && onSelectAuthor && (
            <button
              onClick={() => onSelectAuthor('')}
              className="btn btn-sm btn-ghost"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
            >
              Show All Stories
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
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                padding: '2px',
                background: !selectedAuthorId
                  ? 'linear-gradient(135deg, var(--accent-primary) 0%, #EC4899 100%)'
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
                color: !selectedAuthorId ? 'var(--accent-primary)' : 'var(--text-secondary)'
              }}
            >
              Explore All
            </span>
          </button>

          {/* Author Circles with Glowing Reels */}
          {displayAuthors.map((author, index) => {
            const isSelected = selectedAuthorId === author.id;
            return (
              <div
                key={author.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.375rem',
                  minWidth: '68px',
                  textAlign: 'center'
                }}
              >
                <button
                  onClick={() => {
                    if (onSelectAuthor) {
                      onSelectAuthor(isSelected ? '' : author.id);
                    }
                  }}
                  title={author.latestStoryTitle ? `Latest: ${author.latestStoryTitle}` : author.displayName}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      padding: '2px',
                      background: isSelected
                        ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
                        : 'linear-gradient(135deg, var(--accent-primary) 0%, #EC4899 100%)',
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
                        fontWeight: 700,
                        fontSize: '0.9375rem',
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
                        author.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                </button>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    maxWidth: '68px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {author.displayName.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fullscreen Story Reel Modal */}
      {reelAuthorIndex !== null && (
        <StoryReelModal
          authors={displayAuthors}
          initialAuthorIndex={reelAuthorIndex}
          onClose={() => setReelAuthorIndex(null)}
        />
      )}
    </>
  );
}
