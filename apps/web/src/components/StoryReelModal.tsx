'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { ActiveAuthor, Story } from '@storybabe/types';
import { api } from '../lib/api';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Clock,
  Eye,
  Layers,
  FileText
} from 'lucide-react';

interface StoryReelModalProps {
  authors: ActiveAuthor[];
  initialAuthorIndex?: number;
  onClose: () => void;
}

export default function StoryReelModal({
  authors,
  initialAuthorIndex = 0,
  onClose
}: StoryReelModalProps) {
  const [currentAuthorIndex, setCurrentAuthorIndex] = useState(initialAuthorIndex);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [isLoadingStory, setIsLoadingStory] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const author = authors[currentAuthorIndex];

  useEffect(() => {
    if (author) {
      fetchAuthorStory(author.latestStoryId);
    }
  }, [currentAuthorIndex, author]);

  const fetchAuthorStory = async (storyId: string) => {
    setIsLoadingStory(true);
    setProgress(0);
    try {
      const res = await api.stories.getById(storyId);
      if (res.success && res.data) {
        setCurrentStory(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingStory(false);
    }
  };

  // 5-second automatic progression timer
  useEffect(() => {
    if (isPaused || isLoadingStory) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + 2; // increments every 100ms => 5000ms total
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, isLoadingStory, currentAuthorIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentAuthorIndex]);

  const handleNext = () => {
    if (currentAuthorIndex < authors.length - 1) {
      setCurrentAuthorIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentAuthorIndex > 0) {
      setCurrentAuthorIndex((prev) => prev - 1);
    }
  };

  if (!author) return null;

  const posterBg =
    currentStory?.posterUrl ||
    'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80';

  const onelinerText =
    currentStory?.oneliner ||
    author.latestStoryOneliner ||
    author.latestStoryTitle;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 14, 23, 0.94)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.5rem',
          background: 'rgba(255, 255, 255, 0.12)',
          border: 'none',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1010
        }}
      >
        <X size={24} />
      </button>

      {/* Prev Button (Desktop) */}
      {currentAuthorIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          style={{
            position: 'absolute',
            left: '2rem',
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1010
          }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Next Button (Desktop) */}
      {currentAuthorIndex < authors.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          style={{
            position: 'absolute',
            right: '2rem',
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1010
          }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Main 9:16 / 4:5 Instagram Reel Card Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '84vh',
          maxHeight: '760px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
          backgroundImage: `url(${posterBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        {/* Dark Scrim Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.2) 35%, rgba(15,23,42,0.9) 100%)',
            pointerEvents: 'none'
          }}
        />

        {/* Tap areas for Left (Prev) & Right (Next) navigation */}
        <div
          onClick={handlePrev}
          style={{
            position: 'absolute',
            top: '60px',
            left: 0,
            width: '30%',
            bottom: '100px',
            zIndex: 5,
            cursor: 'pointer'
          }}
        />
        <div
          onClick={handleNext}
          style={{
            position: 'absolute',
            top: '60px',
            right: 0,
            width: '70%',
            bottom: '100px',
            zIndex: 5,
            cursor: 'pointer'
          }}
        />

        {/* Top Segment Progress Bars */}
        <div style={{ position: 'relative', zIndex: 10, padding: '1rem 1rem 0' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '0.75rem' }}>
            {authors.map((a, idx) => (
              <div
                key={a.id}
                style={{
                  flex: 1,
                  height: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#FFFFFF',
                    width:
                      idx < currentAuthorIndex
                        ? '100%'
                        : idx === currentAuthorIndex
                        ? `${progress}%`
                        : '0%',
                    transition: idx === currentAuthorIndex ? 'width 0.1s linear' : 'none'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Author Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              href={`/profile/${author.username}`}
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    overflow: 'hidden'
                  }}
                >
                  {author.avatarUrl ? (
                    <img src={author.avatarUrl} alt={author.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{author.displayName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.2 }}>
                  {author.displayName}
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem' }}>
                  @{author.username}
                </div>
              </div>
            </Link>

            {currentStory && (
              <div
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  color: '#FFFFFF',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {currentStory.type === 'SERIES' ? <Layers size={11} /> : <FileText size={11} />}
                <span>{currentStory.type === 'SERIES' ? 'Series' : 'Single'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Center/Bottom Story Hook & Read Link */}
        <div style={{ position: 'relative', zIndex: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.4375rem',
                fontWeight: 700,
                lineHeight: 1.35,
                color: '#FFFFFF',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                marginBottom: '0.5rem'
              }}
            >
              “{onelinerText}”
            </p>
            <div style={{ color: '#CBD5E1', fontSize: '0.875rem', fontWeight: 600 }}>
              {author.latestStoryTitle}
            </div>
          </div>

          {/* Action to read full story */}
          <Link
            href={`/story/${author.latestStoryId}`}
            onClick={onClose}
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.75rem',
              fontWeight: 700,
              fontSize: '0.9375rem',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
            }}
          >
            <span>Read Full Experience</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
