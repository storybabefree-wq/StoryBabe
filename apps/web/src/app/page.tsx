'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Story, StoryType, StoryStatus } from '@storybabe/types';
import { api } from '../lib/api';
import StoryCard from '../components/StoryCard';
import ActiveAuthorsTray from '../components/ActiveAuthorsTray';
import {
  BookOpen,
  Layers,
  FileText,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  LayoutList,
  LayoutGrid,
  ArrowUp,
  Loader2,
  Check
} from 'lucide-react';

const BATCH_SIZE = 5;

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

  // Track window scroll for Scroll-to-top floating button & scroll restoration
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 600) {
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
      if (res.success && res.data) {
        setPopularTags(res.data);
      }
    } catch {
      // Ignored
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
        const newStories = res.data;
        const total = res.meta?.total || 0;
        const totalPages = res.meta?.totalPages || 1;

        setStories((prev) => (isReset ? newStories : [...prev, ...newStories]));
        setHasMore(pageToFetch < totalPages && newStories.length === BATCH_SIZE);
        setPage(pageToFetch);
      }
    } catch (err) {
      console.error('Fetch stories failed:', err);
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.25rem' }}>
      {/* 1. Top Active Authors / Storytellers Tray with Fullscreen Reel Modal */}
      <ActiveAuthorsTray
        selectedAuthorId={selectedAuthorId}
        onSelectAuthor={(authorId) => setSelectedAuthorId(authorId)}
      />

      {/* 2. Editorial Human-First Hero */}
      <section
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1.75rem',
          marginBottom: '2rem'
        }}
      >
        <div style={{ maxWidth: '780px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.78125rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--accent-primary)',
              marginBottom: '0.5rem'
            }}
          >
            <Sparkles size={14} />
            <span>Real Lives • Visual Stories • Unfiltered Words</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.5rem',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              marginBottom: '0.75rem',
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
              marginBottom: 0
            }}
          >
            No fiction, no advice preaching, no performance. Real voices sharing personal chapters with visual story cards and oneliner hooks.
          </p>
        </div>
      </section>

      {/* 3. Discovery & Feed Filter Bar */}
      <section style={{ marginBottom: '2rem' }}>
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
          {/* Story Type Selector Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'var(--bg-secondary)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <button
              onClick={() => setSelectedType('')}
              className={`btn btn-sm ${selectedType === '' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === '' ? 600 : 500 }}
            >
              All Stories
            </button>
            <button
              onClick={() => setSelectedType('SINGLE')}
              className={`btn btn-sm ${selectedType === 'SINGLE' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === 'SINGLE' ? 600 : 500 }}
            >
              <FileText size={14} />
              <span>Singles</span>
            </button>
            <button
              onClick={() => setSelectedType('SERIES')}
              className={`btn btn-sm ${selectedType === 'SERIES' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: selectedType === 'SERIES' ? 600 : 500 }}
            >
              <Layers size={14} />
              <span>Series</span>
            </button>
          </div>

          {/* Right controls: View Mode Switcher, Completed Only Toggle, Sort, Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                title="Instagram-style Visual Feed"
                className={`btn btn-sm ${layoutMode === 'feed' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', height: '32px' }}
              >
                <LayoutList size={15} />
                <span style={{ fontSize: '0.75rem' }}>Feed</span>
              </button>
              <button
                onClick={() => setLayoutMode('grid')}
                title="Grid Explore View"
                className={`btn btn-sm ${layoutMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', height: '32px' }}
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
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.84375rem',
                fontWeight: 600,
                color: completedOnly ? 'var(--status-completed-text)' : 'var(--text-secondary)',
                backgroundColor: completedOnly ? 'var(--status-completed-bg)' : 'transparent',
                border: completedOnly ? '1px solid var(--status-completed-border)' : '1px solid var(--border-subtle)',
                padding: '0.375rem 0.75rem',
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
              <CheckCircle2 size={15} />
              <span>Completed Only</span>
            </label>

            {/* Sort By Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input"
              style={{ width: 'auto', padding: '0.4375rem 0.75rem', fontSize: '0.84375rem', height: '36px' }}
            >
              <option value="recent">Latest Stories</option>
              <option value="popular">Most Connected</option>
              <option value="views">Most Read</option>
            </select>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.375rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stories..."
                  className="input"
                  style={{ width: '180px', paddingLeft: '2rem', paddingRight: '0.75rem', height: '36px', fontSize: '0.84375rem' }}
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

        {/* Free-Text Mood/Theme Tags bar */}
        {popularTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Themes & Moods:
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
            gap: '2.5rem'
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              <div style={{ padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '6px' }} />
                  <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                </div>
              </div>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '16 / 10', minHeight: '260px' }} />
              <div style={{ padding: '1rem' }}>
                <div className="skeleton" style={{ width: '70%', height: '18px', marginBottom: '8px' }} />
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
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <BookOpen size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No stories found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.9375rem' }}>
            Try adjusting your theme filters or search query to find more personal experiences.
          </p>
          {(selectedType || completedOnly || selectedTag || searchQuery || selectedAuthorId) && (
            <button
              onClick={() => {
                setSelectedType('');
                setCompletedOnly(false);
                setSelectedTag('');
                setSelectedAuthorId('');
                setSearchQuery('');
              }}
              className="btn btn-sm btn-secondary"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        /* Progressive Stories Stream */
        <>
          <div
            style={{
              maxWidth: layoutMode === 'feed' ? '680px' : '100%',
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
                maxWidth: layoutMode === 'feed' ? '680px' : '100%',
                margin: '2rem auto 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '2.5rem'
              }}
            >
              <div
                className="card"
                style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <div style={{ padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '120px', height: '14px', marginBottom: '6px' }} />
                    <div className="skeleton" style={{ width: '80px', height: '10px' }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '16 / 10', minHeight: '260px' }} />
              </div>
            </div>
          )}

          {/* Sentinel Element for IntersectionObserver */}
          <div ref={sentinelRef} style={{ height: '40px', margin: '1rem 0' }} />

          {/* "You're All Caught Up" Instagram Milestone Check */}
          {!hasMore && stories.length > 0 && (
            <div
              style={{
                maxWidth: '460px',
                margin: '3rem auto 2rem',
                textAlign: 'center',
                padding: '2rem 1.5rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)'
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
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem'
                }}
              >
                You're all caught up
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                You've seen all recent genuine personal experiences. Check back later for new chapters.
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
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
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
