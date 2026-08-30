'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { StoryType, StoryStatus, SafetyFlag, PosterStyle, PosterType, PosterPreset } from '@storybabe/types';
import { SAFETY_FLAG_INFO, AESTHETIC_PRESETS } from '@storybabe/types';
import {
  PenSquare,
  Layers,
  FileText,
  AlertTriangle,
  Lock,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Sliders,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  CheckCircle2,
  Wand2,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Sparkle
} from 'lucide-react';

const STYLE_MODIFIERS = [
  '35mm Film Grain',
  'Golden Hour Warmth',
  'Rainy Dusk Noir',
  'Minimalist Fog',
  'Vintage Polaroid',
  'Cinematic Desaturated'
];

export default function NewStoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [type, setType] = useState<StoryType>('SINGLE');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [oneliner, setOneliner] = useState('');
  const [posterMode, setPosterMode] = useState<PosterType>('AI');
  const [posterUrl, setPosterUrl] = useState<string>(AESTHETIC_PRESETS[0].imageUrl);
  const [posterStyle, setPosterStyle] = useState<PosterStyle>('bottom-gradient');
  const [customUploadUrl, setCustomUploadUrl] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(AESTHETIC_PRESETS[0].id);

  // Interactive AI Prompt Studio State
  const [aiScenePrompt, setAiScenePrompt] = useState(
    'Cinematic 35mm film photograph of a quiet window overlooking a misty morning landscape, soft ambient glow. Kodak Portra film grain, muted color palette, fine art editorial composition, no text, 4:5 vertical portrait framing.'
  );
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(['35mm Film Grain', 'Golden Hour Warmth']);
  const [isSuggestingPrompt, setIsSuggestingPrompt] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  const [content, setContent] = useState('');
  const [status, setStatus] = useState<StoryStatus>('ONGOING');
  const [onHoldReason, setOnHoldReason] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [selectedFlags, setSelectedFlags] = useState<SafetyFlag[]>([]);
  const [tagsInput, setTagsInput] = useState('');

  // Series first episode fields
  const [episodeTitle, setEpisodeTitle] = useState('Episode 1: The Beginning');
  const [episodeContent, setEpisodeContent] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleToggleFlag = (flag: SafetyFlag) => {
    if (selectedFlags.includes(flag)) {
      setSelectedFlags(selectedFlags.filter((f) => f !== flag));
    } else {
      setSelectedFlags([...selectedFlags, flag]);
    }
  };

  const handleToggleModifier = (mod: string) => {
    if (selectedModifiers.includes(mod)) {
      setSelectedModifiers(selectedModifiers.filter((m) => m !== mod));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  // Suggest Scene Prompt from Story Title & Summary
  const handleSuggestPrompt = async () => {
    if (!title && !summary && !content) {
      alert('Please enter a title or draft text first so AI can analyze the emotional mood.');
      return;
    }

    setIsSuggestingPrompt(true);
    try {
      const parsedTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await api.stories.suggestPrompt({
        title,
        summary,
        content,
        tags: parsedTags
      });

      if (res.success && res.data) {
        setAiScenePrompt(res.data.suggestedPrompt);
        if (!oneliner || oneliner.trim().length === 0) {
          setOneliner(res.data.suggestedHook);
        }
      }
    } catch (err) {
      console.error('Suggest prompt error:', err);
    } finally {
      setIsSuggestingPrompt(false);
    }
  };

  // Generate Poster using OpenRouter Image API / Curated Fallback
  const handleGenerateAiPoster = async () => {
    setIsGeneratingPoster(true);
    try {
      const parsedTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await api.stories.generatePoster({
        title,
        summary,
        content,
        tags: parsedTags,
        prompt: aiScenePrompt,
        modifiers: selectedModifiers,
        oneliner: oneliner.trim() || undefined,
        style: posterStyle
      });

      if (res.success && res.data) {
        setPosterUrl(res.data.posterUrl);
        if (!oneliner || oneliner.trim().length === 0) {
          setOneliner(res.data.oneliner);
        }
        setPosterMode('AI');
      }
    } catch (err) {
      console.error('AI Poster generation failed:', err);
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const handleAutoExtractHook = () => {
    if (summary) {
      const sentences = summary.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        setOneliner(sentences[0].trim());
      } else {
        setOneliner(summary.slice(0, 110));
      }
    } else if (content) {
      const sentences = content.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 0) {
        setOneliner(sentences[0].trim());
      }
    } else if (title) {
      setOneliner(title);
    }
  };

  const handleSelectPreset = (preset: PosterPreset) => {
    setSelectedPresetId(preset.id);
    setPosterUrl(preset.imageUrl);
    setPosterMode('PRESET');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a story title.');
      return;
    }
    if (!summary.trim()) {
      setError('Please provide a summary describing this real experience.');
      return;
    }

    if (type === 'SINGLE' && !content.trim()) {
      setError('Please provide the full story content.');
      return;
    }

    if (type === 'SERIES' && (!episodeTitle.trim() || !episodeContent.trim())) {
      setError('Please provide the title and content for Season 1, Episode 1.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const payload = {
        type,
        title: title.trim(),
        summary: summary.trim(),
        oneliner: oneliner.trim() || title.trim(),
        posterUrl: posterUrl || null,
        posterStyle,
        posterType: posterMode,
        content: type === 'SINGLE' ? content.trim() : undefined,
        status,
        onHoldReason: status === 'ON_HOLD' ? onHoldReason.trim() : undefined,
        allowComments,
        safetyFlags: selectedFlags,
        tags: parsedTags,
        firstEpisode:
          type === 'SERIES'
            ? {
                title: episodeTitle.trim(),
                content: episodeContent.trim(),
                status: 'COMPLETED'
              }
            : undefined
      };

      const res = await api.stories.create(payload);
      if (res.success && res.data) {
        router.push(`/story/${res.data.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish story.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.25rem' }}>
      {/* Page Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
          <Sparkles size={16} />
          <span style={{ fontSize: '0.78125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Story Creator Studio
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
          Tell Your Side of Things
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', maxWidth: '680px', marginTop: '0.25rem' }}>
          Share authentic personal chapters. Craft a visual 4:5 cover poster and oneliner quote that lets readers connect with your voice.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--priority-badge-bg)',
            border: '1px solid var(--priority-badge-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--priority-badge-text)',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Studio Layout */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '2.5rem', alignItems: 'start' }}>
        {/* Left Column: Story Editor & Poster Studio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 1. Story Type Selector */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
              Story Structure *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setType('SINGLE')}
                className={`card ${type === 'SINGLE' ? 'card-selected' : ''}`}
                style={{
                  padding: '1.125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: type === 'SINGLE' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: type === 'SINGLE' ? 'var(--accent-subtle)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <FileText size={18} color="var(--accent-primary)" />
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Single Story</strong>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  One-shot complete personal narrative.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setType('SERIES')}
                className={`card ${type === 'SERIES' ? 'card-selected' : ''}`}
                style={{
                  padding: '1.125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: type === 'SERIES' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: type === 'SERIES' ? 'var(--accent-subtle)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <Layers size={18} color="var(--accent-primary)" />
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>Series</strong>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  Multi-part personal journey with Season/Episode format.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Title & Summary */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                Story Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Blue Wool Coat in the Closet"
                className="input"
                maxLength={150}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                  Description / Summary *
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {summary.length}/500 chars
                </span>
              </div>
              <textarea
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Write a clear 2-3 sentence summary of what this experience is about..."
                className="textarea"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          {/* 3. Interactive Poster Studio (OpenRouter Image Integration) */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={18} color="var(--accent-primary)" />
                  <span>Story Poster & Hook Studio</span>
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Interactive AI prompt studio and oneliner typography overlay.
                </p>
              </div>
            </div>

            {/* Poster Mode Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <button
                type="button"
                onClick={() => setPosterMode('AI')}
                className={`btn btn-sm ${posterMode === 'AI' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1 }}
              >
                AI Prompt Studio
              </button>
              <button
                type="button"
                onClick={() => setPosterMode('PRESET')}
                className={`btn btn-sm ${posterMode === 'PRESET' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1 }}
              >
                Curated Presets
              </button>
              <button
                type="button"
                onClick={() => setPosterMode('UPLOAD')}
                className={`btn btn-sm ${posterMode === 'UPLOAD' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1 }}
              >
                Custom URL
              </button>
            </div>

            {/* AI Interactive Prompt Studio View */}
            {posterMode === 'AI' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Visual Scene Prompt (Editable)
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestPrompt}
                    disabled={isSuggestingPrompt}
                    className="btn btn-sm btn-secondary"
                    style={{ gap: '0.375rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    <Wand2 size={13} />
                    <span>{isSuggestingPrompt ? 'Analyzing Mood...' : 'Suggest Scene from Story'}</span>
                  </button>
                </div>

                <textarea
                  value={aiScenePrompt}
                  onChange={(e) => setAiScenePrompt(e.target.value)}
                  className="textarea"
                  rows={3}
                  style={{ fontSize: '0.84375rem', lineHeight: 1.5 }}
                  placeholder="Describe the atmospheric scene for your story cover..."
                />

                {/* Style Modifier Pills */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem' }}>
                    Style Modifiers:
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {STYLE_MODIFIERS.map((mod) => {
                      const isSelected = selectedModifiers.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => handleToggleModifier(mod)}
                          style={{
                            padding: '0.25rem 0.625rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                            color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          + {mod}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate Action Button */}
                <button
                  type="button"
                  onClick={handleGenerateAiPoster}
                  disabled={isGeneratingPoster}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontWeight: 700, gap: '0.5rem', padding: '0.75rem' }}
                >
                  <Sparkles size={16} />
                  <span>{isGeneratingPoster ? 'Rendering Image via OpenRouter...' : 'Generate AI Poster Artwork'}</span>
                </button>
              </div>
            )}

            {/* Presets Grid */}
            {posterMode === 'PRESET' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {AESTHETIC_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      style={{
                        position: 'relative',
                        height: '75px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundImage: `url(${preset.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: isSelected ? '3px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        padding: '0.5rem',
                        display: 'flex',
                        alignItems: 'flex-end',
                        textAlign: 'left'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.5)'
                        }}
                      />
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom Image Upload / URL */}
            {posterMode === 'UPLOAD' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.84375rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                  Image URL
                </label>
                <input
                  type="url"
                  value={customUploadUrl}
                  onChange={(e) => {
                    setCustomUploadUrl(e.target.value);
                    if (e.target.value) setPosterUrl(e.target.value);
                  }}
                  placeholder="https://images.unsplash.com/... or your image link"
                  className="input"
                />
              </div>
            )}

            {/* Oneliner Hook Input & Style Controls */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  Oneliner Hook Overlay
                </label>
                <button
                  type="button"
                  onClick={handleAutoExtractHook}
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', color: 'var(--accent-primary)' }}
                >
                  Auto-extract first line
                </button>
              </div>
              <input
                type="text"
                value={oneliner}
                onChange={(e) => setOneliner(e.target.value)}
                placeholder="A punchy 1-sentence hook that captures the emotional core..."
                className="input"
                maxLength={120}
              />
            </div>

            {/* Typography Overlay Position */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                Poster Style Layout
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPosterStyle('bottom-gradient')}
                  className={`btn btn-sm ${posterStyle === 'bottom-gradient' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Bottom Gradient
                </button>
                <button
                  type="button"
                  onClick={() => setPosterStyle('center-spotlight')}
                  className={`btn btn-sm ${posterStyle === 'center-spotlight' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Center Spotlight
                </button>
              </div>
            </div>
          </div>

          {/* 4. Story Content / Episode Content */}
          <div className="card" style={{ padding: '1.5rem' }}>
            {type === 'SINGLE' ? (
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                  Story Content *
                </label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your genuine personal story. Unfiltered words, emotional reflections, and real chapters..."
                  className="textarea"
                  rows={14}
                  style={{ lineHeight: 1.7 }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-tag">Season 1</span>
                  <span className="badge badge-tag">Episode 1</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                    Episode 1 Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={episodeTitle}
                    onChange={(e) => setEpisodeTitle(e.target.value)}
                    placeholder="e.g. Chapter 1: The Initial Step"
                    className="input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                    Episode 1 Content *
                  </label>
                  <textarea
                    required
                    value={episodeContent}
                    onChange={(e) => setEpisodeContent(e.target.value)}
                    placeholder="Write the first episode of your personal series..."
                    className="textarea"
                    rows={12}
                    style={{ lineHeight: 1.7 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Theme / Mood Free-Text Tags */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
              Themes & Mood Tags
            </label>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Comma-separated themes (e.g. reflection, recovery, family, grief, growth, career, solitude).
            </p>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="grief, winter, memory, growth"
              className="input"
            />
          </div>

          {/* 6. Self-Disclosed Safety Flags */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
              Author Self-Disclosed Safety Topics (Optional)
            </label>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Select if this story touches on sensitive topics. Enables on-demand crisis support for readers.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(Object.keys(SAFETY_FLAG_INFO) as SafetyFlag[]).map((flag) => {
                const isSelected = selectedFlags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => handleToggleFlag(flag)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--status-inactive-bg)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--status-inactive-text)' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid var(--status-inactive-border)' : '1px solid var(--border-subtle)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {SAFETY_FLAG_INFO[flag].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Comments Policy */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }}
              />
              <div>
                <strong style={{ fontSize: '0.9375rem', display: 'block' }}>Allow Reader Comments</strong>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Peer feedback and emotional connections on your chapters.
                </span>
              </div>
            </label>
          </div>

          {/* Publish Action */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ padding: '0.875rem', fontSize: '1rem', fontWeight: 700, justifyContent: 'center' }}
          >
            <PenSquare size={18} />
            <span>{isSubmitting ? 'Publishing Story...' : 'Publish Experience to StoryBabe'}</span>
          </button>
        </div>

        {/* Right Column: Sticky Live Feed Post Preview */}
        <div style={{ position: 'sticky', top: '5.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Live Feed Post Preview
            </span>
            <span className="badge badge-tag" style={{ textTransform: 'uppercase' }}>
              {type === 'SERIES' ? 'Series' : 'Single'}
            </span>
          </div>

          {/* 4:5 Poster Card Preview */}
          <div
            className="card"
            style={{
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              boxShadow: 'var(--shadow-modal)'
            }}
          >
            {/* Author Header */}
            <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}
              >
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'Y'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.84375rem', color: 'var(--text-primary)' }}>
                  {user?.displayName || 'Your Name'}
                </div>
                <div style={{ fontSize: '0.71875rem', color: 'var(--text-muted)' }}>
                  @{user?.username || 'your_username'} • Just now
                </div>
              </div>
            </div>

            {/* 4:5 Visual Cover Poster with Typography Overlay */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 5',
                backgroundImage: `url(${posterUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: posterStyle === 'center-spotlight' ? 'center' : 'flex-end',
                padding: '1.5rem',
                overflow: 'hidden'
              }}
            >
              {/* Bottom Gradient Overlay */}
              {posterStyle === 'bottom-gradient' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.85) 100%)'
                  }}
                />
              )}

              {/* Centered Overlay */}
              {posterStyle === 'center-spotlight' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(2px)'
                  }}
                />
              )}

              {/* Overlay Content */}
              <div style={{ position: 'relative', zIndex: 2, color: '#FFFFFF' }}>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '0.5rem'
                  }}
                >
                  {type === 'SERIES' ? 'Series Chapter' : 'Personal Story'}
                </div>

                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    lineHeight: 1.25,
                    marginBottom: '0.5rem',
                    textShadow: '0 2px 8px rgba(0,0,0,0.6)'
                  }}
                >
                  {title || 'Story Title Appears Here'}
                </h2>

                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: '0.9375rem',
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.92)',
                    margin: 0,
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)'
                  }}
                >
                  "{oneliner || 'Your punchy oneliner hook quote will be displayed here...'}"
                </p>
              </div>
            </div>

            {/* Card Actions & Summary Footer */}
            <div style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                  <Heart size={18} />
                  <MessageCircle size={18} />
                  <Share2 size={18} />
                </div>
                <Bookmark size={18} color="var(--text-secondary)" />
              </div>

              <p style={{ fontSize: '0.84375rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {summary || 'Your 2-3 sentence story description summary will appear here for readers on the feed...'}
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
