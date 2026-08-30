'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { Report } from '@storybabe/types';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Clock,
  User,
  ExternalLink,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';

export default function ModerationPage() {
  const { user } = useAuth();
  const [activeQueue, setActiveQueue] = useState<'priority' | 'standard'>('priority');
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({ priorityPending: 0, standardPending: 0, resolvedTotal: 0, totalPending: 0 });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isModeratorOrAdmin = user && (user.role === 'MODERATOR' || user.role === 'ADMIN');

  useEffect(() => {
    if (isModeratorOrAdmin) {
      loadReportsAndStats();
    } else {
      setIsLoading(false);
    }
  }, [user, activeQueue]);

  const loadReportsAndStats = async () => {
    setIsLoading(true);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        api.moderation.listReports(activeQueue, 'PENDING'),
        api.moderation.getStats()
      ]);

      if (reportsRes.success && reportsRes.data) {
        setReports(reportsRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error('Failed to load moderation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeAction = async (actionType: 'WARNING' | 'UNPUBLISH' | 'DISMISS') => {
    if (!selectedReport || !actionNotes.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await api.moderation.takeAction(selectedReport.id, {
        actionType,
        targetType: 'STORY',
        targetId: selectedReport.storyId,
        notes: actionNotes.trim()
      });

      setSelectedReport(null);
      setActionNotes('');
      await loadReportsAndStats();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="page-container">
      {/* Dashboard Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
          <ShieldAlert size={24} color="var(--accent-primary)" />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}>Safety Desk & Moderation</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.90625rem' }}>
          Prioritized review queue for non-consensual identification reports and community safety triage.
        </p>
      </div>

      {/* Moderator Role Guard Notice */}
      {!isModeratorOrAdmin ? (
        <div
          className="card"
          style={{
            padding: '2rem 1.25rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            maxWidth: '640px',
            margin: '2rem auto'
          }}
        >
          <AlertOctagon size={40} color="#E11D48" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Administrator Access Required</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            The Safety Desk review queue and content moderation actions are restricted to StoryBabe administrators and safety moderators.
          </p>
          <Link href="/" className="btn btn-secondary" style={{ margin: '0 auto' }}>
            <span>Return to Stories Feed</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Queue Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
            {/* Priority Queue Card */}
            <div
              onClick={() => setActiveQueue('priority')}
              className="card card-interactive"
              style={{
                padding: '1.25rem',
                cursor: 'pointer',
                borderColor: activeQueue === 'priority' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                backgroundColor: activeQueue === 'priority' ? 'var(--priority-badge-bg)' : 'var(--bg-card)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--priority-badge-text)' }}>
                  Priority Queue (No-Consent)
                </span>
                <AlertTriangle size={16} color="var(--priority-badge-text)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--priority-badge-text)' }}>
                {stats.priorityPending}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--priority-badge-text)', marginTop: '0.25rem' }}>
                Require human review within 24h
              </div>
            </div>

            {/* Standard Queue Card */}
            <div
              onClick={() => setActiveQueue('standard')}
              className="card card-interactive"
              style={{
                padding: '1.25rem',
                cursor: 'pointer',
                borderColor: activeQueue === 'standard' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                backgroundColor: activeQueue === 'standard' ? 'var(--bg-secondary)' : 'var(--bg-card)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Standard Queue
                </span>
                <Clock size={16} color="var(--text-muted)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.standardPending}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Spam, harassment, copyright
              </div>
            </div>

            {/* Resolved Total Card */}
            <div
              className="card"
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-card)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--status-ongoing-text)' }}>
                  Resolved Actions
                </span>
                <ShieldCheck size={16} color="var(--status-ongoing-text)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--status-ongoing-text)' }}>
                {stats.resolvedTotal}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Actions completed to date
              </div>
            </div>
          </div>

          {/* Queue Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveQueue('priority')}
              className={`btn btn-sm ${activeQueue === 'priority' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: 600 }}
            >
              <AlertTriangle size={14} />
              <span>Priority No-Consent Queue ({stats.priorityPending})</span>
            </button>

            <button
              onClick={() => setActiveQueue('standard')}
              className={`btn btn-sm ${activeQueue === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: 600 }}
            >
              <Clock size={14} />
              <span>Standard Queue ({stats.standardPending})</span>
            </button>
          </div>

          {/* Report Review List and Detail Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '1.5rem' }}>
            {/* Reports List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isLoading ? (
                <div className="skeleton" style={{ height: '140px' }} />
              ) : reports.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  <CheckCircle2 size={36} color="var(--status-ongoing-text)" style={{ margin: '0 auto 0.75rem' }} />
                  <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {activeQueue === 'priority' ? 'Priority Queue is Clear' : 'Standard Queue is Clear'}
                  </h3>
                  <p style={{ fontSize: '0.84375rem' }}>No pending reports in this queue requiring moderator action.</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="card card-interactive"
                    style={{
                      padding: '1.25rem',
                      cursor: 'pointer',
                      borderColor: selectedReport?.id === report.id ? 'var(--text-primary)' : 'var(--border-subtle)',
                      backgroundColor: report.category === 'NO_CONSENT' ? 'var(--priority-badge-bg)' : 'var(--bg-card)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {report.priority === 'HIGH' ? (
                          <span className="badge badge-priority">
                            <AlertTriangle size={11} />
                            <span>NO CONSENT • PRIORITY</span>
                          </span>
                        ) : (
                          <span className="badge badge-tag">
                            <span>{report.category}</span>
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Filed {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {report.story?.title || 'Reported Story'}
                    </h4>

                    <p style={{ fontSize: '0.84375rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      <strong>Reason:</strong> {report.reason}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                      <span>Reporter: @{report.reporter?.username || 'user'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Review Case →</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Selected Report Action Drawer */}
            {selectedReport && (
              <div
                className="card"
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-medium)',
                  height: 'fit-content',
                  position: 'sticky',
                  top: '90px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span className={`badge ${selectedReport.priority === 'HIGH' ? 'badge-priority' : 'badge-tag'}`} style={{ marginBottom: '0.375rem' }}>
                      {selectedReport.priority === 'HIGH' ? 'High Priority Case' : 'Standard Case'}
                    </span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                      Review: {selectedReport.story?.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setSelectedReport(null)}
                    className="btn btn-sm btn-ghost"
                    style={{ padding: '0.25rem' }}
                  >
                    Close
                  </button>
                </div>

                {/* Target Story Information */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.84375rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ marginBottom: '0.375rem' }}>
                    <strong>Author:</strong> {selectedReport.story?.author?.displayName} (@{selectedReport.story?.author?.username})
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Reporter Reason:</strong> {selectedReport.reason}
                  </div>
                  <Link
                    href={`/story/${selectedReport.storyId}`}
                    target="_blank"
                    className="btn btn-sm btn-secondary"
                    style={{ gap: '0.25rem', fontSize: '0.75rem' }}
                  >
                    <span>Inspect Full Story in Reader</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>

                {/* Moderator Decision Notes */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Moderator Action Notes
                  </label>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Document your review findings and rationale for this decision..."
                    className="textarea"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleTakeAction('UNPUBLISH')}
                    disabled={isProcessing || !actionNotes.trim()}
                    className="btn btn-sm btn-accent"
                    style={{ gridColumn: '1 / -1' }}
                  >
                    <XCircle size={15} />
                    <span>Take Down & Unpublish Story</span>
                  </button>

                  <button
                    onClick={() => handleTakeAction('WARNING')}
                    disabled={isProcessing || !actionNotes.trim()}
                    className="btn btn-sm btn-secondary"
                  >
                    Issue Author Warning
                  </button>

                  <button
                    onClick={() => handleTakeAction('DISMISS')}
                    disabled={isProcessing || !actionNotes.trim()}
                    className="btn btn-sm btn-ghost"
                  >
                    Dismiss Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
