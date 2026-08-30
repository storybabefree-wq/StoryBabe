'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Story, StoryType, UserProfile } from '@storybabe/types';
import { api } from '../lib/api';
import StoryCard from '../components/StoryCard';
import ActiveAuthorsTray from '../components/ActiveAuthorsTray';
import {
  BookOpen,
  Layers,
  FileText,
  CheckCircle2,
  Search,
  X,
  Sparkles,
  LayoutList,
  LayoutGrid,
  ArrowUp,
  PenSquare,
  Compass,
  Check
} from 'lucide-react';

const BATCH_SIZE = 6;

const mockAuthor1: UserProfile = {
  id: 'author-1',
  username: 'elena_writes',
  displayName: 'Elena Vance',
  avatarUrl: null,
  role: 'AUTHOR',
  followersCount: 340,
  followingCount: 42,
  storiesCount: 8,
  usernameChangesCount: 0,
  canChangeUsername: true,
  daysUntilNextUsernameChange: 0,
  emailVerified: true,
  createdAt: new Date().toISOString()
};

const mockAuthor2: UserProfile = {
  id: 'author-2',
  username: 'marcus_reid',
  displayName: 'Marcus Reid',
  avatarUrl: null,
  role: 'AUTHOR',
  followersCount: 210,
  followingCount: 19,
  storiesCount: 5,
  usernameChangesCount: 0,
  canChangeUsername: true,
  daysUntilNextUsernameChange: 0,
  emailVerified: true,
  createdAt: new Date().toISOString()
};

const mockAuthor3: UserProfile = {
  id: 'author-3',
  username: 'sarah_chen',
  displayName: 'Sarah Chen',
  avatarUrl: null,
  role: 'AUTHOR',
  followersCount: 480,
  followingCount: 65,
  storiesCount: 12,
  usernameChangesCount: 0,
  canChangeUsername: true,
  daysUntilNextUsernameChange: 0,
  emailVerified: true,
  createdAt: new Date().toISOString()
};

// Curated Showcase Chapters displayed when exploring
const SHOWCASE_STORIES: Story[] = [
  {
    id: 'showcase-1',
    authorId: 'author-1',
    author: mockAuthor1,
    title: 'The 4:00 AM Decision That Changed Everything',
    summary: 'Sometimes you have to walk away from the life you planned to find the life that belongs to you. It was a Tuesday morning when the alarm went off at 4:00 AM. I sat by the window watching the streetlights flicker out and finally admitted the truth to myself.',
    content: 'It was a Tuesday morning when the alarm went off at 4:00 AM. I had been doing the exact same commute for six years, pretending the hollow feeling in my chest was just fatigue. That morning, I sat by the window watching the streetlights flicker out and finally admitted the truth to myself...',
    oneliner: 'Sometimes you have to walk away from the life you planned to find the life that belongs to you.',
    posterUrl: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4338ca 100%)',
    posterStyle: 'bottom-gradient',
    posterType: 'PRESET',
    type: 'SINGLE',
    status: 'COMPLETED',
    isInactive: false,
    allowComments: true,
    safetyFlags: [],
    tags: ['decisions', 'career', 'growth'],
    viewsCount: 680,
    likesCount: 142,
    commentsCount: 28,
    episodesCount: 1,
    readingTimeMinutes: 4,
    isLikedByViewer: false,
    isBookmarkedByViewer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  },
  {
    id: 'showcase-2',
    authorId: 'author-2',
    author: mockAuthor2,
    title: 'Leaving the Familiar Coast: A Reflection on Solitude',
    summary: 'The apartment had nothing except a suitcase and an echo. Moving across the country at twenty-four felt like jumping out of an airplane without checking if the parachute was packed properly. In that silence, I learned who I actually was when nobody was watching.',
    content: 'The apartment had nothing except a suitcase and an echo. Moving across the country at twenty-four felt like jumping out of an airplane without checking if the parachute was packed properly. But in that quiet silence, I learned who I actually was when nobody was watching...',
    oneliner: 'Learning how to be alone in a city where nobody knows your surname.',
    posterUrl: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f766e 100%)',
    posterStyle: 'bottom-gradient',
    posterType: 'PRESET',
    type: 'SERIES',
    status: 'ONGOING',
    isInactive: false,
    allowComments: true,
    safetyFlags: [],
    tags: ['solitude', 'citylife', 'journey'],
    viewsCount: 420,
    likesCount: 98,
    commentsCount: 19,
    episodesCount: 3,
    readingTimeMinutes: 6,
    isLikedByViewer: false,
    isBookmarkedByViewer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  },
  {
    id: 'showcase-3',
    authorId: 'author-3',
    author: mockAuthor3,
    title: 'Letters I Never Sent to My Twenty-Year-Old Self',
    summary: 'If I could sit across from you at that dusty coffee shop on 5th Avenue, I would not warn you about the mistakes. I would simply tell you to breathe through the uncertainty. Everything you think is the end of the world is actually just the end of a prologue.',
    content: 'If I could sit across from you at that dusty coffee shop on 5th Avenue, I would not warn you about the mistakes. I would simply tell you to breathe through the uncertainty. Everything you think is the end of the world is actually just the end of a prologue...',
    oneliner: 'You are going to survive the heartbreak, and the failure will become your foundation.',
    posterUrl: 'linear-gradient(135deg, #31103f 0%, #701a75 50%, #db2777 100%)',
    posterStyle: 'bottom-gradient',
    posterType: 'PRESET',
    type: 'SINGLE',
    status: 'COMPLETED',
    isInactive: false,
    allowComments: true,
    safetyFlags: [],
    tags: ['letters', 'reflection', 'healing'],
    viewsCount: 940,
    likesCount: 215,
    commentsCount: 44,
    episodesCount: 1,
    readingTimeMinutes: 5,
    isLikedByViewer: false,
    isBookmarkedByViewer: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString()
  }
];

export default function HomePage() {
  const searchParams = useSearchParams();
  const initialTag = searchParams?.get('tag') || '';

  const [stories, setStories] = useState<Story[]>([]);
  const [popularTags, setPopularTags] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [selectedType, setSelectedType] = useState<StoryType | ''>('');
  const [completedOnly, setCompletedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>(initialTag);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'views'>('recent');
  const [layoutMode, setLayoutMode] = useState<'feed' | 'grid'>('feed');

  // Progressive Infinite Scroll States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  // Track window scroll for Scroll-to-top floating button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 500) {
        setShowScrollToTop(true);
      } else {
        setShowScrollToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initial fetch / Filter Reset
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchStories(1, true);
  }, [selectedType, completedOnly, selectedTag, selectedAuthorId, sortBy]);

  const fetchTags = async () => {
    try {
      const res = await api.stories.getPopularTags();
      if (res.success && res.data && res.data.length > 0) {
        setPopularTags(res.data);
      } else {
        setPopularTags([
          { id: '1', name: 'reflection', count: 18 },
          { id: '2', name: 'growth', count: 14 },
          { id: '3', name: 'career', count: 12 },
          { id: '4', name: 'relationships', count: 11 },
          { id: '5', name: 'healing', count: 9 },
          { id: '6', name: 'solitude', count: 7 }
        ]);
      }
    } catch {
      setPopularTags([
        { id: '1', name: 'reflection', count: 18 },
        { id: '2', name: 'growth', count: 14 },
        { id: '3', name: 'career', count: 12 },
        { id: '4', name: 'relationships', count: 11 }
      ]);
    }
  };

  const fetchStories = async (pageToFetch: number, isReset = false) => {
    if (isReset) {
      setIsLoadingInitial(true);
    } else {
      setIsFetchingNextPage(true);
    }

    try {
      const res = await api.stories.list({
        type: selectedType || undefined,
        completedOnly,
        tag: selectedTag || undefined,
        authorId: selectedAuthorId || undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        page: pageToFetch,
        limit: BATCH_SIZE
      });

      if (res.success && res.data) {
        const fetched = res.data;
        const total = res.meta?.total || 0;
        const totalPages = res.meta?.totalPages || 1;

        if (fetched.length === 0 && pageToFetch === 1 && !selectedTag && !searchQuery && !selectedAuthorId) {
          setStories(SHOWCASE_STORIES);
          setHasMore(false);
        } else {
          setStories((prev) => (isReset ? fetched : [...prev, ...fetched]));
          setHasMore(pageToFetch < totalPages && fetched.length === BATCH_SIZE);
        }
        setPage(pageToFetch);
      } else {
        if (pageToFetch === 1) {
          setStories(SHOWCASE_STORIES);
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Fetch stories failed:', err);
      if (pageToFetch === 1) {
        setStories(SHOWCASE_STORIES);
        setHasMore(false);
      }
    } finally {
      setIsLoadingInitial(false);
      setIsFetchingNextPage(false);
    }
  };

  // Infinite scroll IntersectionObserver setup
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isFetchingNextPage && !isLoadingInitial) {
        fetchStories(page + 1, false);
      }
    },
    [hasMore, isFetchingNextPage, isLoadingInitial, page, selectedType, completedOnly, selectedTag, selectedAuthorId, sortBy, searchQuery]
  );

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: '250px',
      threshold: 0.1
    };
    const observer = new IntersectionObserver(handleObserver, option);
    if (sentinelRef.current) observer.observe(sentinelRef.current);

    return () => {
      if (sentinelRef.current) observer.unobserve(sentinelRef.current);
    };
  }, [handleObserver]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setHasMore(true);
    fetchStories(1, true);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '1.75rem 1.25rem' }}>
      {/* 1. Top Active Authors / Storytellers Reel Tray */}
      <ActiveAuthorsTray
        selectedAuthorId={selectedAuthorId}
        onSelectAuthor={(authorId) => setSelectedAuthorId(authorId)}
      />

      {/* 2. Editorial Spotlight Hero Banner */}
      <section
        style={{
          position: 'relative',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(236, 72, 153, 0.04) 50%, rgba(15, 23, 42, 0.02) 100%)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '2.25rem',
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: '780px', position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-subtle)',
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-xs)',
              marginBottom: '1rem'
            }}
          >
            <Sparkles size={13} />
            <span>Real Lives • Unfiltered Words • Community Stories</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              marginBottom: '0.875rem',
              color: 'var(--text-primary)'
            }}
          >
            Personal experiences, told by the people who lived them.
          </h1>

          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
              maxWidth: '640px'
            }}
          >
            No clickbait, no advice preaching. Authentic monologues, multi-part chapters, and candid personal stories.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            <Link
              href="/new-story"
              className="btn btn-primary"
              style={{ fontWeight: 700, padding: '0.75rem 1.35rem', gap: '0.5rem' }}
            >
              <PenSquare size={17} />
              <span>Write Your Story</span>
            </Link>

            <button
              onClick={() => {
                const el = document.getElementById('story-feed-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{ fontWeight: 600, padding: '0.75rem 1.25rem' }}
            >
              <Compass size={17} />
              <span>Explore Chapters</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Discovery & Filter Bar */}
      <section id="story-feed-section" style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}
        >
          {/* Format Tabs: All / Singles / Series */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: 'var(--bg-secondary)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <button
              onClick={() => setSelectedType('')}
              className={`btn btn-sm ${selectedType === '' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === '' ? 700 : 500 }}
            >
              All Stories
            </button>
            <button
              onClick={() => setSelectedType('SINGLE')}
              className={`btn btn-sm ${selectedType === 'SINGLE' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === 'SINGLE' ? 700 : 500 }}
            >
              <FileText size={14} />
              <span>Singles</span>
            </button>
            <button
              onClick={() => setSelectedType('SERIES')}
              className={`btn btn-sm ${selectedType === 'SERIES' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === 'SERIES' ? 700 : 500 }}
            >
              <Layers size={14} />
              <span>Series</span>
            </button>
          </div>

          {/* Right Controls: Layout Mode, Completed Filter, Sort, Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            {/* Layout Mode Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-secondary)',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <button
                onClick={() => setLayoutMode('feed')}
                title="Magazine Visual Feed"
                className={`btn btn-sm ${layoutMode === 'feed' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: '32px' }}
              >
                <LayoutList size={15} />
                <span style={{ fontSize: '0.75rem' }}>Feed</span>
              </button>
              <button
                onClick={() => setLayoutMode('grid')}
                title="Grid Explore View"
                className={`btn btn-sm ${layoutMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', height: '32px' }}
              >
                <LayoutGrid size={15} />
                <span style={{ fontSize: '0.75rem' }}>Grid</span>
              </button>
            </div>

            {/* Completed Only Filter Toggle */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: completedOnly ? 'var(--status-completed-text)' : 'var(--text-secondary)',
                backgroundColor: completedOnly ? 'var(--status-completed-bg)' : 'transparent',
                border: completedOnly ? '1px solid var(--status-completed-border)' : '1px solid var(--border-subtle)',
                padding: '0.375rem 0.625rem',
                borderRadius: 'var(--radius-sm)',
                transition: 'all var(--transition-fast)',
                height: '36px'
              }}
            >
              <input
                type="checkbox"
                checked={completedOnly}
                onChange={(e) => setCompletedOnly(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <CheckCircle2 size={14} />
              <span>Completed</span>
            </label>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input"
              style={{ width: 'auto', padding: '0.375rem 0.625rem', fontSize: '0.8125rem', height: '36px' }}
            >
              <option value="recent">Latest Stories</option>
              <option value="popular">Most Connected</option>
              <option value="views">Most Read</option>
            </select>

            {/* Live Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.375rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stories..."
                  className="input"
                  style={{ width: '180px', paddingLeft: '2rem', paddingRight: '0.75rem', height: '36px', fontSize: '0.8125rem' }}
                />
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
            </form>
          </div>
        </div>

        {/* Thematic Mood Tag Bar */}
        {popularTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              Themes:
            </span>

            {selectedTag && (
              <button
                onClick={() => setSelectedTag('')}
                className="badge badge-priority"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span>#{selectedTag}</span>
                <X size={12} />
              </button>
            )}

            {popularTags.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTag(selectedTag === t.name ? '' : t.name)}
                className={`badge badge-tag ${selectedTag === t.name ? 'badge-primary' : ''}`}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedTag === t.name ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: selectedTag === t.name ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 4. Stories Stream */}
      {isLoadingInitial ? (
        <div
          style={{
            maxWidth: layoutMode === 'feed' ? '680px' : '100%',
            margin: '0 auto',
            display: layoutMode === 'feed' ? 'flex' : 'grid',
            flexDirection: 'column',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '2rem'
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '6px' }} />
                  <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                </div>
              </div>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '16 / 9', minHeight: '220px' }} />
              <div style={{ padding: '1.25rem' }}>
                <div className="skeleton" style={{ width: '70%', height: '20px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '90%', height: '12px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)'
          }}
        >
          <BookOpen size={42} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No stories match your filter
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.9375rem' }}>
            Try resetting your theme filters or search query to explore all community chapters.
          </p>
          <button
            onClick={() => {
              setSelectedType('');
              setCompletedOnly(false);
              setSelectedTag('');
              setSelectedAuthorId('');
              setSearchQuery('');
            }}
            className="btn btn-primary"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        /* Stories Magazine Feed */
        <>
          <div
            style={{
              maxWidth: layoutMode === 'feed' ? '700px' : '100%',
              margin: '0 auto',
              display: layoutMode === 'feed' ? 'flex' : 'grid',
              flexDirection: 'column',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: layoutMode === 'feed' ? '2.5rem' : '1.75rem'
            }}
          >
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                layoutMode={layoutMode}
                onLikeToggle={(id, liked, count) => {
                  setStories((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, isLikedByViewer: liked, likesCount: count } : s))
                  );
                }}
              />
            ))}
          </div>

          {/* Shimmering Skeleton for Next Batch */}
          {isFetchingNextPage && (
            <div
              style={{
                maxWidth: layoutMode === 'feed' ? '700px' : '100%',
                margin: '2rem auto 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '2.5rem'
              }}
            >
              <div
                className="card"
                style={{
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '6px' }} />
                    <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '16 / 9', minHeight: '220px' }} />
              </div>
            </div>
          )}

          {/* Sentinel Element for IntersectionObserver */}
          <div ref={sentinelRef} style={{ height: '40px', margin: '1rem 0' }} />

          {/* "You're All Caught Up" Milestone */}
          {!hasMore && stories.length > 0 && (
            <div
              style={{
                maxWidth: '460px',
                margin: '3rem auto 2rem',
                textAlign: 'center',
                padding: '2.25rem 1.5rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-card)'
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-completed-bg)',
                  color: 'var(--status-completed-text)',
                  border: '1px solid var(--status-completed-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <Check size={26} strokeWidth={2.5} />
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem'
                }}
              >
                You're all caught up
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                You've explored all recent personal experience chapters. Check back soon for new community releases.
              </p>
              <button onClick={scrollToTop} className="btn btn-sm btn-secondary" style={{ gap: '0.375rem' }}>
                <ArrowUp size={14} />
                <span>Back to Top</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          title="Scroll back to top"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(79, 70, 229, 0.4)',
            zIndex: 90,
            transition: 'transform var(--transition-fast)'
          }}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}
