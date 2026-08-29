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
  PauseCircle,
  Clock3,
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
  const [isExpanded, setIsExpanded] = useState(false);
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
    'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80';

  const onelinerText = story.oneliner || story.summary.slice(0, 120) + (story.summary.length > 120 ? '...' : '');
  const styleMode = story.posterStyle || 'bottom-gradient';

  return (
    <>
      <article
        className="card card-interactive"
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-card)',
          marginBottom: layoutMode === 'feed' ? '2.5rem' : '0'
        }}
      >
        {/* 1. Header: Author Info, Time, Three Dots Dropdown Menu */}
        <div
          style={{
            padding: '0.875rem 1.125rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <Link
            href={`/profile/${story.author.username}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
          >
            {/* Avatar Ring */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                padding: '2px',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #EC4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
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
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden'
                }}
              >
                {story.author.avatarUrl ? (
                  <img
                    src={story.author.avatarUrl}
                    alt={story.author.displayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{story.author.displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {story.author.displayName}
              </div>
              <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                @{story.author.username} • {new Date(story.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }} ref={menuRef}>
            {/* Status Badge */}
            {story.status === 'COMPLETED' && (
              <span className="badge badge-completed" style={{ fontSize: '0.6875rem' }}>
                <CheckCircle2 size={10} />
                <span>Complete</span>
              </span>
            )}
            {story.status === 'ON_HOLD' && (
              <span className="badge badge-onhold" style={{ fontSize: '0.6875rem' }} title={story.onHoldReason || ''}>
                <PauseCircle size={10} />
                <span>On Hold</span>
              </span>
            )}
            {story.isInactive && (
              <span className="badge badge-inactive" style={{ fontSize: '0.6875rem' }}>
                <Clock3 size={10} />
                <span>Inactive</span>
              </span>
            )}

            {/* Three Dots (...) Options Menu Button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="btn btn-sm btn-ghost"
              title="Post options"
              style={{ padding: '0.375rem', color: 'var(--text-secondary)' }}
            >
              <MoreHorizontal size={18} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.25rem',
                  width: '210px',
                  padding: '0.375rem',
                  zIndex: 80,
                  boxShadow: 'var(--shadow-modal)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <button
                  onClick={handleShare}
                  className="btn btn-sm btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem' }}
                >
                  {copied ? <Check size={14} color="var(--accent-primary)" /> : <Copy size={14} />}
                  <span>{copied ? 'Link Copied!' : 'Copy Story Link'}</span>
                </button>

                {!isAuthor && (
                  <button
                    onClick={handleToggleFollow}
                    className="btn btn-sm btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem' }}
                  >
                    {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    <span>{isFollowing ? `Unfollow @${story.author.username}` : `Follow @${story.author.username}`}</span>
                  </button>
                )}

                <button
                  onClick={handleBookmark}
                  className="btn btn-sm btn-ghost"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem' }}
                >
                  <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                  <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Story'}</span>
                </button>

                {!isAuthor && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                    className="btn btn-sm btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem', color: '#E11D48' }}
                  >
                    <Flag size={14} />
                    <span>Report Story</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. Visual Story Poster with Stylized Oneliner Overlay */}
        <Link
          href={`/story/${story.id}`}
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            aspectRatio: layoutMode === 'feed' ? '16 / 10' : '4 / 3',
            minHeight: '260px',
            backgroundImage: `url(${posterBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            textDecoration: 'none',
            overflow: 'hidden'
          }}
        >
          {/* Poster Gradient Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                styleMode === 'center-spotlight'
                  ? 'radial-gradient(circle at center, rgba(15,23,42,0.4) 0%, rgba(10,14,23,0.88) 100%)'
                  : styleMode === 'top-minimal'
                  ? 'linear-gradient(180deg, rgba(10,14,23,0.92) 0%, rgba(10,14,23,0.4) 60%, rgba(10,14,23,0.85) 100%)'
                  : 'linear-gradient(180deg, rgba(10,14,23,0.15) 0%, rgba(10,14,23,0.65) 45%, rgba(10,14,23,0.95) 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent:
                styleMode === 'center-spotlight'
                  ? 'center'
                  : styleMode === 'top-minimal'
                  ? 'flex-start'
                  : 'flex-end',
              padding: '1.75rem',
              textAlign: styleMode === 'center-spotlight' ? 'center' : 'left'
            }}
          >
            {/* Top Series / Single Type Pill */}
            <div
              style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(6px)',
                color: '#FFFFFF',
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              {story.type === 'SERIES' ? <Layers size={13} /> : <FileText size={13} />}
              <span>{story.type === 'SERIES' ? `Series • ${story.episodesCount || 1} Parts` : 'Single Story'}</span>
            </div>

            {/* The Oneliner Hook Overlay */}
            <div style={{ maxWidth: '90%', margin: styleMode === 'center-spotlight' ? '0 auto' : '0' }}>
              <p
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: layoutMode === 'feed' ? '1.5rem' : '1.25rem',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: '-0.015em',
                  color: '#FFFFFF',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
                  marginBottom: '0.5rem'
                }}
              >
                “{onelinerText}”
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <span>{story.title}</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 3. Action Row: Like, Comment, Bookmark, Share */}
        <div
          style={{
            padding: '0.75rem 1.125rem 0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Like / Connected */}
            <button
              onClick={handleLike}
              disabled={isLiking}
              title="I connected with this"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: isLiked ? 'var(--accent-rose)' : 'var(--text-primary)',
                transition: 'transform var(--transition-fast)'
              }}
            >
              <Heart size={22} fill={isLiked ? 'var(--accent-rose)' : 'none'} color={isLiked ? 'var(--accent-rose)' : 'currentColor'} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{likesCount}</span>
            </button>

            {/* Comment Bubble */}
            <Link
              href={`/story/${story.id}#comments`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: 'var(--text-primary)',
                textDecoration: 'none'
              }}
            >
              <MessageCircle size={22} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{story.commentsCount || 0}</span>
            </Link>

            {/* Share */}
            <button
              onClick={handleShare}
              title="Copy link to story"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <Share2 size={20} />
              {copied && <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Copied!</span>}
            </button>
          </div>

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            title="Bookmark story"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isBookmarked ? 'var(--accent-primary)' : 'var(--text-primary)'
            }}
          >
            <Bookmark size={22} fill={isBookmarked ? 'var(--accent-primary)' : 'none'} />
          </button>
        </div>

        {/* 4. Description, Tags & Read More */}
        <div style={{ padding: '0.25rem 1.125rem 1.125rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Story Title */}
          <Link href={`/story/${story.id}`} style={{ textDecoration: 'none' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.3
              }}
            >
              {story.title}
            </h2>
          </Link>

          {/* Summary Snippet with Expandable Toggle */}
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              marginBottom: 0
            }}
          >
            {isExpanded ? story.summary : story.summary.slice(0, 160) + (story.summary.length > 160 ? '...' : '')}
            {story.summary.length > 160 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '0.375rem'
                }}
              >
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </p>

          {/* Tags Bar */}
          {story.tags && story.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', margin: '0.25rem 0' }}>
              {story.tags.map((tag) => (
                <span key={tag} className="badge badge-tag" style={{ fontSize: '0.75rem' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Bottom Metrics & Read Action */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Eye size={14} />
                <span>{story.viewsCount} views</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={14} />
                <span>{story.readingTimeMinutes} min read</span>
              </span>
            </div>

            <Link
              href={`/story/${story.id}`}
              className="btn btn-sm btn-primary"
              style={{ gap: '0.375rem', padding: '0.375rem 0.875rem', fontWeight: 600 }}
            >
              <span>Read Story</span>
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
