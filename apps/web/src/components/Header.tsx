'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  PenSquare,
  ShieldAlert,
  Users,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Sparkles,
  ChevronDown,
  Settings,
  CheckCircle2,
  Lock,
  Home
} from 'lucide-react';
import AuthModal from './AuthModal';
import UsernameModal from './UsernameModal';

export default function Header() {
  const pathname = usePathname();
  const { user, logout, theme, toggleTheme } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsMenu]);

  return (
    <>
      {/* Top Header */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: 'var(--shadow-subtle)',
          width: '100%'
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          {/* Brand Wordmark & Primary Clean Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.25rem',
                textDecoration: 'none'
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: 'var(--text-primary)'
                }}
              >
                StoryBabe
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  marginLeft: '2px'
                }}
              />
            </Link>

            {/* Desktop Core Navigation Links */}
            <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Link
                href="/"
                className={`btn btn-sm ${pathname === '/' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ fontWeight: pathname === '/' ? 700 : 500 }}
              >
                <BookOpen size={16} />
                <span>Read</span>
              </Link>

              {user && (
                <Link
                  href="/following"
                  className={`btn btn-sm ${pathname === '/following' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ fontWeight: pathname === '/following' ? 700 : 500 }}
                >
                  <Users size={16} />
                  <span>Following</span>
                </Link>
              )}

              <Link
                href="/new-story"
                className={`btn btn-sm ${pathname === '/new-story' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontWeight: 700 }}
              >
                <PenSquare size={16} />
                <span>Write</span>
              </Link>
            </nav>
          </div>

          {/* Right Action Bar: Theme + User / Settings Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} ref={menuRef}>
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="btn btn-sm btn-ghost"
              aria-label="Toggle theme"
              style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              /* Logged In User Avatar & Settings Dropdown */
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="btn btn-sm btn-secondary"
                  style={{ gap: '0.375rem', padding: '0.3rem 0.5rem' }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      padding: '1px',
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
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)'
                      }}
                    >
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.displayName}
                  </span>
                  <ChevronDown size={14} />
                </button>

                {showSettingsMenu && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.375rem',
                      width: '260px',
                      padding: '0.5rem',
                      zIndex: 80,
                      boxShadow: 'var(--shadow-modal)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    {/* User Header */}
                    <div style={{ padding: '0.625rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.375rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>{user.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {user.canChangeUsername ? (
                          <span style={{ color: 'var(--status-completed-text)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={11} />
                            <span>Username change available</span>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Lock size={11} />
                            <span>Username cooldown: {user.daysUntilNextUsernameChange}d left</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/profile/${user.username}`}
                      onClick={() => setShowSettingsMenu(false)}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84375rem', gap: '0.5rem' }}
                    >
                      <UserIcon size={15} />
                      <span>View Profile</span>
                    </Link>

                    <button
                      onClick={() => {
                        setShowSettingsMenu(false);
                        setShowUsernameModal(true);
                      }}
                      className="btn btn-sm btn-ghost"
                      style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84375rem', gap: '0.5rem' }}
                    >
                      <Settings size={15} />
                      <span>Change Username</span>
                    </button>

                    {/* Admin Safety Desk Option */}
                    {user.role === 'ADMIN' && (
                      <Link
                        href="/moderation"
                        onClick={() => setShowSettingsMenu(false)}
                        className="btn btn-sm btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84375rem', gap: '0.5rem', color: 'var(--accent-primary)' }}
                      >
                        <ShieldAlert size={15} />
                        <span>Safety Desk Queue</span>
                      </Link>
                    )}

                    {/* Log Out */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.375rem', paddingTop: '0.375rem' }}>
                      <button
                        onClick={() => {
                          logout();
                          setShowSettingsMenu(false);
                        }}
                        className="btn btn-sm btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.84375rem', gap: '0.5rem', color: '#E11D48' }}
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Signed Out State */
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn btn-sm btn-primary"
                  style={{ fontWeight: 700 }}
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <Link href="/" className={`mobile-nav-item ${pathname === '/' ? 'active' : ''}`}>
          <Home size={20} />
          <span>Feed</span>
        </Link>

        {user ? (
          <Link href="/following" className={`mobile-nav-item ${pathname === '/following' ? 'active' : ''}`}>
            <Users size={20} />
            <span>Following</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="mobile-nav-item"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Users size={20} />
            <span>Following</span>
          </button>
        )}

        <Link href="/new-story" className="mobile-nav-item" style={{ overflow: 'visible' }}>
          <div className="mobile-nav-write-btn">
            <PenSquare size={20} />
          </div>
          <span style={{ marginTop: '2px' }}>Write</span>
        </Link>

        {user ? (
          <Link href={`/profile/${user.username}`} className={`mobile-nav-item ${pathname.startsWith('/profile') ? 'active' : ''}`}>
            <UserIcon size={20} />
            <span>Profile</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="mobile-nav-item"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <UserIcon size={20} />
            <span>Sign In</span>
          </button>
        )}
      </nav>

      {/* Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showUsernameModal && <UsernameModal onClose={() => setShowUsernameModal(false)} />}
    </>
  );
}
