'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Story } from '@storybabe/types';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import ReportModal from './ReportModal';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Eye,
  Clock,
  Layers,
  FileText,
  CheckCircle2,
  UserPlus,
  UserCheck,
  ArrowRight,
  MoreHorizontal,
  Flag,
  Copy,
  Check
} from 'lucide-react';

interface StoryCardProps {
  story: Story;
  layoutMode?: 'feed' | 'grid';
  onLikeToggle?: (storyId: string, isLiked: boolean, count: number) => void;
}

export default function StoryCard({ story, layoutMode = 'feed', onLikeToggle }: StoryCardProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(story.isLikedByViewer || false);
  const [likesCount, setLikesCount] = useState(story.likesCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(story.isBookmarkedByViewer || false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor = user?.id === story.authorId;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      alert('Please sign in to react to stories.');
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);

    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    try {
      const res = await api.stories.toggleLike(story.id);
      if (res.success && res.data) {
        setIsLiked(res.data.isLiked);
        setLikesCount(res.data.likesCount);
        if (onLikeToggle) {
          onLikeToggle(story.id, res.data.isLiked, res.data.likesCount);
        }
      }
    } catch {
      setIsLiked(!nextLiked);
      setLikesCount(likesCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleBookmark = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      alert('Please sign in to bookmark stories.');
      return;
    }

    const nextBookmarked = !isBookmarked;
    setIsBookmarked(nextBookmarked);
    setShowMenu(false);

    try {
      const res = await api.social.toggleBookmark(story.id);
      if (res.success && res.data) {
        setIsBookmarked(res.data.isBookmarked);
      }
    } catch {
      setIsBookmarked(!nextBookmarked);
    }
  };

  const handleToggleFollow = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user) {
      alert('Please sign in to follow authors.');
      return;
    }

    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setShowMenu(false);

    try {
      const res = await api.social.toggleFollow(story.authorId);
      if (res.success && res.data) {
        setIsFollowing(res.data.isFollowing);
      }
    } catch {
      setIsFollowing(!nextFollowing);
    }
  };

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const url = typeof window !== 'undefined' ? `${window.location.origin}/story/${story.id}` : '';
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowMenu(false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const posterBg =
    story.posterUrl ||
    'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)';

  const readTime = story.readingTimeMinutes || Math.max(1, Math.ceil((story.summary || story.content || '').split(/\s+/).length / 200));

  return (
    <>
      <article
        className="card card-hoverable"
        style={{
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          position: 'relative'
        }}
      >
        {/* Top Author Signature Bar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <Link
            href={`/profile/${story.author?.username || story.authorId}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #EC4899 100%)',
                padding: '1.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                {story.author?.avatarUrl ? (
                  <img
                    src={story.author.avatarUrl}
                    alt={story.author.displayName}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  (story.author?.displayName || 'A').charAt(0).toUpperCase()
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {story.author?.displayName || 'StoryBabe Author'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                @{story.author?.username || 'author'}
              </div>
            </div>
          </Link>

          {/* Format & Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: story.type === 'SERIES' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                color: story.type === 'SERIES' ? '#A855F7' : 'var(--accent-primary)',
                border: story.type === 'SERIES' ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {story.type === 'SERIES' ? <Layers size={11} /> : <FileText size={11} />}
              <span>{story.type === 'SERIES' ? `SERIES • ${story.episodesCount || 1} PARTS` : 'SINGLE'}</span>
            </span>

            {story.status === 'COMPLETED' && (
              <span className="badge badge-completed" style={{ fontSize: '0.6875rem' }}>
                <CheckCircle2 size={11} />
                <span>COMPLETED</span>
              </span>
            )}

            {/* Overflow menu */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <MoreHorizontal size={18} />
              </button>

              {showMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.25rem',
                    width: '180px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-modal)',
                    padding: '0.375rem',
                    zIndex: 60
                  }}
                >
                  <button
                    type="button"
                    onClick={handleShare}
                    className="btn btn-sm btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem' }}
                  >
                    {copied ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
                    <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBookmark}
                    className="btn btn-sm btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem' }}
                  >
                    <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                    <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark'}</span>
                  </button>

                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem' }}
                    >
                      {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                      <span>{isFollowing ? 'Unfollow Author' : 'Follow Author'}</span>
                    </button>
                  )}

                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowReportModal(true);
                      }}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', color: '#E11D48' }}
                    >
                      <Flag size={14} />
                      <span>Report Story</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Visual Poster Banner */}
        <Link
          href={`/story/${story.id}`}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: layoutMode === 'grid' ? '16 / 10' : '16 / 9',
            minHeight: layoutMode === 'grid' ? '180px' : '220px',
            background: posterBg,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '1.5rem',
            textDecoration: 'none',
            overflow: 'hidden'
          }}
        >
          {/* Subtle dark gradient overlay for text legibility */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)'
            }}
          />

          {/* Oneliner Hook Overlay */}
          {story.oneliner && (
            <div style={{ position: 'relative', zIndex: 2, marginBottom: '0.5rem' }}>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#F8FAFC',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  fontStyle: 'italic',
                  maxWidth: '90%',
                  lineHeight: 1.4
                }}
              >
                "{story.oneliner}"
              </div>
            </div>
          )}

          {/* Main Story Title */}
          <h2
            style={{
              position: 'relative',
              zIndex: 2,
              fontFamily: 'var(--font-serif)',
              fontSize: layoutMode === 'grid' ? '1.25rem' : '1.65rem',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
              margin: 0
            }}
          >
            {story.title}
          </h2>
        </Link>

        {/* Card Body Snippet */}
        <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: layoutMode === 'grid' ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {(story.summary || story.content || story.oneliner || 'Personal experience story chapter.').replace(/[#*`_]/g, '')}
          </p>

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              {story.tags.slice(0, 4).map((tag: any, idx: number) => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                return (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-xs)'
                    }}
                  >
                    #{tagName}
                  </span>
                );
              })}
            </div>
          )}

          {/* Card Footer Interaction Row */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '0.875rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}
          >
            {/* Left Interactions: Likes, Comments, Read Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Like Button */}
              <button
                type="button"
                onClick={handleLike}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isLiked ? '#E11D48' : 'var(--text-muted)',
                  fontSize: '0.84375rem',
                  fontWeight: 600,
                  transition: 'transform var(--transition-fast)'
                }}
                title="React"
              >
                <Heart size={18} fill={isLiked ? '#E11D48' : 'none'} />
                <span>{likesCount}</span>
              </button>

              {/* Comments Link */}
              <Link
                href={`/story/${story.id}#comments`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.84375rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
                title="Comments"
              >
                <MessageCircle size={18} />
                <span>{story.commentsCount || 0}</span>
              </Link>

              {/* Reading time */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <Clock size={13} />
                <span>{readTime} min</span>
              </span>
            </div>

            {/* Right: Read Story CTA */}
            <Link
              href={`/story/${story.id}`}
              className="btn btn-sm btn-ghost"
              style={{
                color: 'var(--accent-primary)',
                fontWeight: 700,
                fontSize: '0.8125rem',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem'
              }}
            >
              <span>Read Chapter</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </article>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          storyId={story.id}
          storyTitle={story.title}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
}
