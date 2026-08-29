'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Story, Episode } from '@storybabe/types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import CrisisModal from '../../../components/CrisisModal';
import CommentsSection from '../../../components/CommentsSection';
import ReportModal from '../../../components/ReportModal';
import {
  Heart,
  Eye,
  Bookmark,
  ShieldAlert,
  Clock,
  Layers,
  FileText,
  UserPlus,
  UserCheck,
  CheckCircle2,
  PauseCircle,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Type,
  Sun,
  Moon,
  Sparkles,
  ArrowLeft,
  MoreHorizontal,
  HeartHandshake,
  Share2,
  Copy,
  Check,
  Flag
} from 'lucide-react';

export default function StoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params?.id as string;
  const { user } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [showThreeDotsMenu, setShowThreeDotsMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reader Customizer state
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerTheme, setReaderTheme] = useState<'default' | 'warm' | 'sepia' | 'night'>('default');

  useEffect(() => {
    if (storyId) {
      loadStory();
    }
  }, [storyId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowThreeDotsMenu(false);
      }
    };
    if (showThreeDotsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThreeDotsMenu]);

  const loadStory = async () => {
    setIsLoading(true);
    try {
      const res = await api.stories.getById(storyId);
      if (res.success && res.data) {
        const s = res.data;
        setStory(s);
        setIsLiked(s.isLikedByViewer || false);
        setLikesCount(s.likesCount || 0);
        setIsBookmarked(s.isBookmarkedByViewer || false);

        // Select first episode if Series
        if (s.type === 'SERIES' && s.episodes && s.episodes.length > 0) {
          setSelectedEpisode(s.episodes[0]);
          api.episodes.trackView(s.episodes[0].id).catch(() => {});
        } else {
          api.stories.trackView(s.id).catch(() => {});
        }

        // Check follow status if logged in
        if (user && s.authorId) {
          api.social
            .getFollowStatus(s.authorId)
            .then((fRes) => {
              if (fRes.success && fRes.data) {
                setIsFollowing(fRes.data.isFollowing);
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to load story:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!user) {
      alert('Please sign in to follow authors.');
      return;
    }
    if (!story) return;

    try {
      const res = await api.social.toggleFollow(story.authorId);
      if (res.success && res.data) {
        setIsFollowing(res.data.isFollowing);
        setShowThreeDotsMenu(false);
      }
    } catch (err: any) {
      alert(err.message || 'Follow failed');
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      alert('Please sign in to connect with this story.');
      return;
    }
    if (!story) return;

    const targetId = selectedEpisode ? selectedEpisode.id : story.id;
    const isEpisode = !!selectedEpisode;

    const nextLiked = !isLiked;
    const nextCount = nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    try {
      if (isEpisode) {
        const res = await api.episodes.toggleLike(targetId);
        if (res.success && res.data) {
          setIsLiked(res.data.isLiked);
          setLikesCount(res.data.likesCount);
        }
      } else {
        const res = await api.stories.toggleLike(targetId);
        if (res.success && res.data) {
          setIsLiked(res.data.isLiked);
          setLikesCount(res.data.likesCount);
        }
      }
    } catch {
      setIsLiked(!nextLiked);
      setLikesCount(likesCount);
    }
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      alert('Please sign in to bookmark stories.');
      return;
    }
    if (!story) return;

    const nextBookmarked = !isBookmarked;
    setIsBookmarked(nextBookmarked);
    setShowThreeDotsMenu(false);
    try {
      const res = await api.social.toggleBookmark(story.id);
      if (res.success && res.data) {
        setIsBookmarked(res.data.isBookmarked);
      }
    } catch {
      setIsBookmarked(!nextBookmarked);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/story/${story?.id}` : '';
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShowThreeDotsMenu(false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDismissInactive = async () => {
    if (!story) return;
    try {
      const res = await api.stories.dismissInactive(story.id);
      if (res.success && res.data) {
        setStory(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to dismiss inactive tag');
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '3rem 1.25rem' }}>
        <div className="skeleton" style={{ height: '30px', width: '30%', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ height: '50px', width: '90%', marginBottom: '1rem' }} />
        <div className="skeleton" style={{ height: '24px', width: '50%', marginBottom: '2.5rem' }} />
        <div className="skeleton" style={{ height: '300px', width: '100%' }} />
      </div>
    );
  }

  if (!story) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '0 1.25rem' }}>
        <h2>Story not found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 1.5rem' }}>
          This story may have been removed or is unavailable.
        </p>
        <Link href="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </Link>
      </div>
    );
  }

  const isAuthor = user?.id === story.authorId;
  const currentContent = selectedEpisode ? selectedEpisode.content : story.content || '';
  const currentTitle = selectedEpisode ? selectedEpisode.title : story.title;
  const currentReadTime = selectedEpisode ? selectedEpisode.readingTimeMinutes : story.readingTimeMinutes;

  // Reader class names
  const readerThemeClass =
    readerTheme === 'warm'
      ? 'reader-theme-warm'
      : readerTheme === 'sepia'
      ? 'reader-theme-sepia'
      : readerTheme === 'night'
      ? 'reader-theme-night'
      : '';

  const fontSizeStyle =
    fontSize === 'large'
      ? { fontSize: '1.3125rem', lineHeight: 1.9 }
      : fontSize === 'xlarge'
      ? { fontSize: '1.4375rem', lineHeight: 2.0 }
      : {};

  return (
    <div className={readerThemeClass} style={{ minHeight: '80vh', transition: 'background-color 0.2s ease' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '2rem 1.25rem' }}>
        {/* Top Breadcrumb & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <Link href="/" className="btn btn-sm btn-ghost" style={{ gap: '0.375rem', paddingLeft: 0 }}>
            <ArrowLeft size={16} />
            <span>Stories Feed</span>
          </Link>

          {/* Reader Display Customizer Tools */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'var(--bg-secondary)',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {/* Font family switch */}
            <button
              onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
              className="btn btn-sm btn-ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600 }}
              title="Toggle Serif / Sans Font"
            >
              {fontFamily === 'serif' ? 'Serif' : 'Sans'}
            </button>

            {/* Font size toggle */}
            <button
              onClick={() => {
                if (fontSize === 'normal') setFontSize('large');
                else if (fontSize === 'large') setFontSize('xlarge');
                else setFontSize('normal');
              }}
              className="btn btn-sm btn-ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              title="Change Text Size"
            >
              <Type size={14} />
              <span>{fontSize === 'normal' ? '1x' : fontSize === 'large' ? '1.2x' : '1.4x'}</span>
            </button>

            {/* Reading theme */}
            <select
              value={readerTheme}
              onChange={(e) => setReaderTheme(e.target.value as any)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <option value="default">Default</option>
              <option value="warm">Warm Paper</option>
              <option value="sepia">Sepia</option>
              <option value="night">Night Mode</option>
            </select>
          </div>
        </div>

        {/* Inactivity Notice (Author Dismissal Option) */}
        {story.isInactive && (
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--status-inactive-bg)',
              border: '1px solid var(--status-inactive-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-inactive-text)',
              marginBottom: '1.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock3 size={18} />
              <span style={{ fontSize: '0.875rem' }}>
                This series has been marked <strong>Inactive</strong> (no new episode in 60+ days). Authors are never penalized.
              </span>
            </div>
            {isAuthor && (
              <button onClick={handleDismissInactive} className="btn btn-sm btn-secondary">
                Dismiss Inactive Tag
              </button>
            )}
          </div>
        )}

        {/* Story Header */}
        <header style={{ marginBottom: '2rem' }}>
          {/* Status & Type Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
            <span className="badge badge-tag" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {story.type === 'SERIES' ? 'Series' : 'Single Story'}
            </span>

            {story.status === 'COMPLETED' && (
              <span className="badge badge-completed">
                <CheckCircle2 size={12} />
                <span>Completed</span>
              </span>
            )}

            {story.status === 'ONGOING' && (
              <span className="badge badge-ongoing">
                <span>Ongoing</span>
              </span>
            )}

            {story.status === 'ON_HOLD' && (
              <span className="badge badge-onhold">
                <PauseCircle size={12} />
                <span>On Hold</span>
              </span>
            )}

            {story.tags &&
              story.tags.map((t) => (
                <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="badge badge-tag">
                  #{t}
                </Link>
              ))}
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.25rem',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}
          >
            {story.title}
          </h1>

          {/* On Hold Reason if any */}
          {story.status === 'ON_HOLD' && story.onHoldReason && (
            <div
              style={{
                backgroundColor: 'var(--status-onhold-bg)',
                border: '1px solid var(--status-onhold-border)',
                color: 'var(--status-onhold-text)',
                padding: '0.5rem 0.875rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.84375rem',
                marginBottom: '1.25rem'
              }}
            >
              <strong>Author Status Update:</strong> {story.onHoldReason}
            </div>
          )}

          {/* Author bar with Three Dots Options and Discrete Crisis Support Button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            {/* Author Avatar & Follow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link href={`/profile/${story.author.username}`}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
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
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      overflow: 'hidden'
                    }}
                  >
                    {story.author.avatarUrl ? (
                      <img src={story.author.avatarUrl} alt={story.author.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>{story.author.displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </Link>

              <div>
                <Link
                  href={`/profile/${story.author.username}`}
                  style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem', display: 'block', lineHeight: 1.2 }}
                >
                  {story.author.displayName}
                </Link>
                <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                  @{story.author.username} • {new Date(story.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {!isAuthor && (
                <button
                  onClick={handleToggleFollow}
                  className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ marginLeft: '0.5rem', padding: '0.25rem 0.625rem', fontSize: '0.78125rem', gap: '0.25rem' }}
                >
                  {isFollowing ? <UserCheck size={13} /> : <UserPlus size={13} />}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
              )}
            </div>

            {/* Read Stats, Discrete Crisis Support Button & Three Dots Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', color: 'var(--text-muted)', fontSize: '0.84375rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} />
                <span>{currentReadTime} min read</span>
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Eye size={14} />
                <span>{story.viewsCount} views</span>
              </span>

              {/* Discrete Crisis Support Button (gentle pill) */}
              <button
                onClick={() => setShowCrisisModal(true)}
                className="btn btn-sm btn-ghost"
                title="Crisis Support & 24/7 Lifelines"
                style={{
                  gap: '0.375rem',
                  fontSize: '0.78125rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.25rem 0.5rem'
                }}
              >
                <HeartHandshake size={14} color="#E11D48" />
                <span>Crisis Support</span>
              </button>

              {/* Three Dots Menu */}
              <div style={{ position: 'relative' }} ref={menuRef}>
                <button
                  onClick={() => setShowThreeDotsMenu(!showThreeDotsMenu)}
                  className="btn btn-sm btn-ghost"
                  title="Story options"
                  style={{ padding: '0.375rem', color: 'var(--text-secondary)' }}
                >
                  <MoreHorizontal size={18} />
                </button>

                {showThreeDotsMenu && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.25rem',
                      width: '220px',
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

                    <button
                      onClick={handleToggleBookmark}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem' }}
                    >
                      <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                      <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Story'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowThreeDotsMenu(false);
                        setShowCrisisModal(true);
                      }}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8125rem', gap: '0.5rem' }}
                    >
                      <HeartHandshake size={14} color="#E11D48" />
                      <span>Crisis Lifelines & Help</span>
                    </button>

                    {!isAuthor && (
                      <button
                        onClick={() => {
                          setShowThreeDotsMenu(false);
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
          </div>
        </header>

        {/* Series Episode Selector (if SERIES) */}
        {story.type === 'SERIES' && story.episodes && story.episodes.length > 0 && (
          <nav
            aria-label="Series Episodes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.75rem',
              marginBottom: '1.75rem',
              borderBottom: '1px solid var(--border-subtle)'
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Episodes:
            </span>
            {story.episodes.map((ep) => {
              const isSelected = selectedEpisode?.id === ep.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpisode(ep);
                    api.episodes.trackView(ep.id).catch(() => {});
                  }}
                  className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}
                >
                  <span>
                    S{ep.seasonNumber} E{ep.episodeNumber}: {ep.title}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Episode On Hold Reason if any */}
        {selectedEpisode?.status === 'ON_HOLD' && selectedEpisode.onHoldReason && (
          <div
            style={{
              backgroundColor: 'var(--status-onhold-bg)',
              border: '1px solid var(--status-onhold-border)',
              color: 'var(--status-onhold-text)',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.84375rem',
              marginBottom: '1.5rem'
            }}
          >
            <strong>Episode Note:</strong> {selectedEpisode.onHoldReason}
          </div>
        )}

        {/* Story / Episode Text Content (Editorial Typography) */}
        <main
          className={fontFamily === 'serif' ? 'story-text-serif' : 'story-text-sans'}
          style={{
            ...fontSizeStyle,
            color: 'var(--text-primary)',
            padding: '1rem 0 3rem',
            borderBottom: '1px solid var(--border-subtle)',
            minHeight: '280px',
            whiteSpace: 'pre-line'
          }}
        >
          {currentContent}
        </main>

        {/* Story Reaction & Engagement Bar */}
        <section
          aria-label="Story Engagement"
          style={{
            padding: '1.75rem 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={handleToggleLike}
              className={`btn btn-md ${isLiked ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                gap: '0.5rem',
                backgroundColor: isLiked ? 'var(--accent-rose)' : undefined,
                borderColor: isLiked ? 'var(--accent-rose)' : undefined,
                color: isLiked ? '#FFFFFF' : undefined
              }}
            >
              <Heart size={18} fill={isLiked ? '#FFFFFF' : 'none'} />
              <span>{isLiked ? 'I Connected With This' : 'I Connect With This'}</span>
              <span style={{ fontWeight: 700 }}>({likesCount})</span>
            </button>

            <button
              onClick={handleToggleBookmark}
              className="btn btn-md btn-secondary"
              title="Bookmark for later"
              style={{ gap: '0.375rem' }}
            >
              <Bookmark size={17} fill={isBookmarked ? 'currentColor' : 'none'} />
              <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={handleShare} className="btn btn-sm btn-ghost" style={{ gap: '0.375rem' }}>
              <Share2 size={15} />
              <span>{copied ? 'Link Copied!' : 'Share Story'}</span>
            </button>
          </div>
        </section>

        {/* Reader Comments Section */}
        <CommentsSection
          storyId={story.id}
          storyAuthorId={story.authorId}
          episodeId={selectedEpisode?.id}
          allowComments={story.allowComments}
        />
      </div>

      {/* Discrete Crisis Modal */}
      {showCrisisModal && (
        <CrisisModal
          flags={story.safetyFlags}
          onClose={() => setShowCrisisModal(false)}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          storyId={story.id}
          episodeId={selectedEpisode?.id}
          storyTitle={story.title}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
