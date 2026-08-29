'use client';

import React, { useState, useEffect } from 'react';
import type { Comment } from '@storybabe/types';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { MessageSquare, Heart, Reply, MessageSquareOff, Send } from 'lucide-react';
import Link from 'next/link';

interface CommentsSectionProps {
  storyId: string;
  storyAuthorId: string;
  episodeId?: string | null;
  allowComments: boolean;
}

export default function CommentsSection({
  storyId,
  storyAuthorId,
  episodeId,
  allowComments
}: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [storyId, episodeId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await api.social.getComments(storyId, episodeId || undefined);
      if (res.success && res.data) {
        setComments(res.data);
      }
    } catch {
      // Ignored if failed
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.social.postComment(storyId, {
        content: newComment.trim(),
        episodeId: episodeId || null
      });

      if (res.success && res.data) {
        setComments([res.data, ...comments]);
        setNewComment('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!user || !replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.social.postComment(storyId, {
        content: replyContent.trim(),
        episodeId: episodeId || null,
        parentId
      });

      if (res.success && res.data) {
        // Append reply under parent
        setComments(
          comments.map((c) => {
            if (c.id === parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), res.data!]
              };
            }
            return c;
          })
        );
        setReplyToId(null);
        setReplyContent('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, isReply: boolean = false, parentId?: string) => {
    if (!user) {
      alert('Please sign in to react to comments.');
      return;
    }

    try {
      const res = await api.social.toggleCommentLike(commentId);
      if (res.success && res.data) {
        const { isLiked, likesCount } = res.data;
        if (!isReply) {
          setComments(
            comments.map((c) =>
              c.id === commentId ? { ...c, isLikedByViewer: isLiked, likesCount } : c
            )
          );
        } else if (parentId) {
          setComments(
            comments.map((c) => {
              if (c.id === parentId && c.replies) {
                return {
                  ...c,
                  replies: c.replies.map((r) =>
                    r.id === commentId ? { ...r, isLikedByViewer: isLiked, likesCount } : r
                  )
                };
              }
              return c;
            })
          );
        }
      }
    } catch {
      // Ignored
    }
  };

  if (!allowComments) {
    return (
      <section style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <MessageSquareOff size={24} />
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Comments Disabled
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            The author has chosen to disable comments for this story.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginTop: '3.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <MessageSquare size={20} color="var(--text-primary)" />
        <h3 style={{ fontSize: '1.25rem' }}>Reflections & Thoughts ({comments.length})</h3>
      </div>

      {/* Post comment input */}
      {user ? (
        <form onSubmit={handlePostComment} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.875rem',
                flexShrink: 0
              }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flexGrow: 1 }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share a thoughtful reaction or personal connection to this story..."
                className="textarea"
                rows={3}
                style={{ marginBottom: '0.5rem' }}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-sm btn-primary" disabled={isSubmitting || !newComment.trim()}>
                  <Send size={13} />
                  <span>{isSubmitting ? 'Posting...' : 'Post Reflection'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            textAlign: 'center'
          }}
        >
          Please sign in to leave a reflection or reply to comments.
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: '70px' }} />
          <div className="skeleton" style={{ height: '70px' }} />
        </div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No reflections yet. Be the first to share your connection to this story.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '1.25rem'
              }}
            >
              {/* Comment author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <Link
                  href={`/profile/${comment.user.username}`}
                  style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}
                >
                  {comment.user.displayName}
                </Link>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  @{comment.user.username}
                </span>
                {comment.userId === storyAuthorId && (
                  <span className="badge badge-tag" style={{ fontSize: '0.6875rem', padding: '1px 5px' }}>
                    Author
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Content */}
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '0.5rem' }}>
                {comment.content}
              </p>

              {/* Action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78125rem' }}>
                <button
                  onClick={() => handleLikeComment(comment.id, false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: comment.isLikedByViewer ? 'var(--accent-primary)' : 'var(--text-muted)'
                  }}
                >
                  <Heart size={13} fill={comment.isLikedByViewer ? 'currentColor' : 'none'} />
                  <span>{comment.likesCount}</span>
                </button>

                {user && (
                  <button
                    onClick={() => {
                      setReplyToId(replyToId === comment.id ? null : comment.id);
                      setReplyContent('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <Reply size={13} />
                    <span>Reply</span>
                  </button>
                )}
              </div>

              {/* Inline Reply Form */}
              {replyToId === comment.id && (
                <div style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', borderLeft: '2px solid var(--border-subtle)' }}>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Reply to @${comment.user.username}...`}
                    className="textarea"
                    rows={2}
                    style={{ marginBottom: '0.375rem', fontSize: '0.875rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setReplyToId(null)}
                      className="btn btn-sm btn-ghost"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePostReply(comment.id)}
                      className="btn btn-sm btn-primary"
                      disabled={isSubmitting || !replyContent.trim()}
                    >
                      Post Reply
                    </button>
                  </div>
                </div>
              )}

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div style={{ marginTop: '0.875rem', paddingLeft: '1.25rem', borderLeft: '2px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <Link
                          href={`/profile/${reply.user.username}`}
                          style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}
                        >
                          {reply.user.displayName}
                        </Link>
                        <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)' }}>
                          @{reply.user.username}
                        </span>
                        {reply.userId === storyAuthorId && (
                          <span className="badge badge-tag" style={{ fontSize: '0.625rem', padding: '1px 4px' }}>
                            Author
                          </span>
                        )}
                        <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {new Date(reply.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '0.375rem' }}>
                        {reply.content}
                      </p>
                      <button
                        onClick={() => handleLikeComment(reply.id, true, comment.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: reply.isLikedByViewer ? 'var(--accent-primary)' : 'var(--text-muted)',
                          fontSize: '0.75rem'
                        }}
                      >
                        <Heart size={12} fill={reply.isLikedByViewer ? 'currentColor' : 'none'} />
                        <span>{reply.likesCount}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
