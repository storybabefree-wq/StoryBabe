'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { UserProfile, Story } from '@storybabe/types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import StoryCard from '../../../components/StoryCard';
import UsernameModal from '../../../components/UsernameModal';
import {
  User as UserIcon,
  UserPlus,
  UserCheck,
  Calendar,
  Sparkles,
  Edit3,
  Clock,
  CheckCircle2,
  BookOpen,
  ArrowLeft
} from 'lucide-react';

export default function ProfilePage() {
  const params = useParams();
  const rawUsername = params?.username as string;
  const { user: currentUser, refreshUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    if (rawUsername) {
      loadProfileData();
    }
  }, [rawUsername, currentUser]);

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      const res = await api.auth.getAuthorProfile(rawUsername);
      if (res.success && res.data) {
        setProfile(res.data);
        setFollowersCount(res.data.followersCount);
        setEditDisplayName(res.data.displayName);
        setEditBio(res.data.bio || '');

        // Check follow status if logged in and not owner
        if (currentUser && currentUser.id !== res.data.id) {
          const followRes = await api.social.getFollowStatus(res.data.id);
          if (followRes.success && followRes.data) {
            setIsFollowing(followRes.data.isFollowing);
          }
        }

        // Fetch author's stories
        const storiesRes = await api.stories.list({ authorId: res.data.id });
        if (storiesRes.success && storiesRes.data) {
          setStories(storiesRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUser) {
      alert('Please sign in to follow authors.');
      return;
    }
    if (!profile) return;

    try {
      const res = await api.social.toggleFollow(profile.id);
      if (res.success && res.data) {
        setIsFollowing(res.data.isFollowing);
        setFollowersCount(res.data.followersCount);
      }
    } catch (err: any) {
      alert(err.message || 'Follow failed');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.auth.updateProfile({
        displayName: editDisplayName.trim(),
        bio: editBio.trim()
      });
      if (res.success) {
        await refreshUser();
        setShowEditProfileModal(false);
        loadProfileData();
      }
    } catch (err: any) {
      alert(err.message || 'Update failed');
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.25rem' }}>
        <div className="skeleton" style={{ height: '140px', marginBottom: '2rem' }} />
        <div className="skeleton" style={{ height: '200px' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '0 1.25rem' }}>
        <h2>Author Not Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 1.5rem' }}>
          We could not find an author matching @{rawUsername}.
        </p>
        <Link href="/" className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Feed</span>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.25rem' }}>
      {/* Profile Header Card */}
      <section
        className="card"
        style={{
          padding: '1.5rem',
          marginBottom: '2rem',
          backgroundColor: 'var(--bg-card)',
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', flex: 1, minWidth: '240px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                flexShrink: 0
              }}
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                {profile.displayName}
              </h1>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.625rem' }}>
                @{profile.username}
              </div>

              {profile.bio && (
                <p style={{ fontSize: '0.90625rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '580px', marginBottom: '0.75rem' }}>
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{followersCount}</strong> Followers
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{profile.followingCount}</strong> Following
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>{stories.length}</strong> Stories
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div>
            {isOwner ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  className="btn btn-sm btn-secondary"
                >
                  <Edit3 size={14} />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={() => setShowUsernameModal(true)}
                  className="btn btn-sm btn-secondary"
                >
                  <Sparkles size={14} />
                  <span>Change Username</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleToggleFollow}
                className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
              >
                {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Identity & Cooldown Indicator (Only for Profile Owner) */}
        {isOwner && currentUser && (
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.8125rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {currentUser.canChangeUsername ? (
                <span className="badge badge-ongoing">
                  <CheckCircle2 size={12} />
                  <span>Username change available</span>
                </span>
              ) : (
                <span className="badge badge-onhold">
                  <Clock size={12} />
                  <span>Cooldown active: {currentUser.daysUntilNextUsernameChange} days left</span>
                </span>
              )}
              <span style={{ color: 'var(--text-muted)' }}>
                (Rule: 1 free change, then 30-day cooldown)
              </span>
            </div>

            <div style={{ color: 'var(--text-muted)' }}>
              Private email: <strong>{currentUser.email}</strong> (hidden from public)
            </div>
          </div>
        )}
      </section>

      {/* Author Stories Section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <BookOpen size={20} color="var(--text-primary)" />
          <h2 style={{ fontSize: '1.375rem' }}>Stories by {profile.displayName}</h2>
        </div>

        {stories.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <p>No stories published by this author yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        )}
      </section>

      {/* Change Username Modal */}
      {showUsernameModal && <UsernameModal onClose={() => setShowUsernameModal(false)} />}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="modal-overlay" onClick={() => setShowEditProfileModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', marginBottom: '1.25rem' }}>Edit Public Profile</h3>
            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                  Display Name (Changeable anytime)
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="textarea"
                  rows={3}
                  placeholder="Share a few words about what you write and experience..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
