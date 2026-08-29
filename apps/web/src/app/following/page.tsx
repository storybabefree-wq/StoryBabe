'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Story } from '@storybabe/types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import StoryCard from '../../components/StoryCard';
import { Users, BookOpen, UserPlus, ArrowLeft } from 'lucide-react';

export default function FollowingPage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadFollowingFeed();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadFollowingFeed = async () => {
    setIsLoading(true);
    try {
      const res = await api.social.getFollowingFeed();
      if (res.success && res.data) {
        setStories(res.data);
      }
    } catch (err) {
      console.error('Failed to load following feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '0 1.25rem' }}>
        <Users size={36} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Follow the Voices You Connect With</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Sign in to read stories from authors whose perspectives and personal experiences resonate with you.
        </p>
        <Link href="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Browse All Stories</span>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.25rem' }}>
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Users size={22} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>Following Feed</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          Latest experiences and serialized episodes from authors you follow.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card" style={{ height: '240px', padding: '1.375rem' }}>
              <div className="skeleton" style={{ height: '20px', width: '40%', marginBottom: '1rem' }} />
              <div className="skeleton" style={{ height: '24px', width: '80%', marginBottom: '0.75rem' }} />
              <div className="skeleton" style={{ height: '60px', width: '100%' }} />
            </div>
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          <UserPlus size={36} style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            No stories in your following feed yet
          </h3>
          <p style={{ fontSize: '0.90625rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            When you follow authors whose voices you connect with, their new personal experiences and series episodes will appear here.
          </p>
          <Link href="/" className="btn btn-primary">
            Explore All Stories & Authors
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  );
}
