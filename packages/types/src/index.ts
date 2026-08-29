export type UserRole = 'READER' | 'AUTHOR' | 'MODERATOR' | 'ADMIN';

export type StoryType = 'SINGLE' | 'SERIES';

export type StoryStatus = 'ONGOING' | 'COMPLETED' | 'ON_HOLD';

export type EpisodeStatus = 'DRAFT' | 'ONGOING' | 'COMPLETED' | 'ON_HOLD';

export type PosterStyle = 'bottom-gradient' | 'center-spotlight' | 'top-minimal';

export type PosterType = 'AI' | 'UPLOAD' | 'PRESET' | 'MINIMAL';

export interface PosterPreset {
  id: string;
  name: string;
  mood: string;
  imageUrl: string;
  gradient: string;
  textColor: string;
}

export const AESTHETIC_PRESETS: PosterPreset[] = [
  {
    id: 'midnight-rain',
    name: 'Midnight Rain',
    mood: 'Contemplative & Melancholic',
    imageUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(180deg, rgba(10,15,25,0.2) 0%, rgba(10,15,25,0.92) 100%)',
    textColor: '#FFFFFF'
  },
  {
    id: 'foggy-coast',
    name: 'Foggy Coast',
    mood: 'Quiet Solitude & Transitions',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.9) 100%)',
    textColor: '#FFFFFF'
  },
  {
    id: 'amber-dawn',
    name: 'Amber Dawn',
    mood: 'Hope, Recovery & New Days',
    imageUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(180deg, rgba(30,15,10,0.2) 0%, rgba(20,10,5,0.92) 100%)',
    textColor: '#FFFFFF'
  },
  {
    id: 'neon-twilight',
    name: 'Neon Twilight',
    mood: 'Late Night Thoughts & Urban Solitude',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(180deg, rgba(20,10,35,0.2) 0%, rgba(10,5,20,0.95) 100%)',
    textColor: '#FFFFFF'
  },
  {
    id: 'deep-pine',
    name: 'Deep Forest',
    mood: 'Grounded Reflection & Solitude',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(180deg, rgba(10,25,20,0.2) 0%, rgba(5,15,10,0.94) 100%)',
    textColor: '#FFFFFF'
  },
  {
    id: 'minimal-slate',
    name: 'Obsidian Velvet',
    mood: 'Pure Focus & Modern Editorial',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1000&q=80',
    gradient: 'linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%)',
    textColor: '#FFFFFF'
  }
];

export type SafetyFlag =
  | 'SELF_HARM'
  | 'ABUSE'
  | 'DEATH_LOSS'
  | 'SUBSTANCE_USE'
  | 'MENTAL_HEALTH_CRISIS';

export const SAFETY_FLAG_INFO: Record<SafetyFlag, { label: string; description: string }> = {
  SELF_HARM: {
    label: 'Self-Harm',
    description: 'Content discussing or referencing self-inflicted harm or suicide ideation.'
  },
  ABUSE: {
    label: 'Abuse',
    description: 'Content discussing physical, emotional, domestic, or psychological abuse.'
  },
  DEATH_LOSS: {
    label: 'Death & Loss',
    description: 'Content dealing with bereavement, tragic loss of loved ones, or grief.'
  },
  SUBSTANCE_USE: {
    label: 'Substance Use',
    description: 'Content discussing severe addiction, overdose, or substance dependence.'
  },
  MENTAL_HEALTH_CRISIS: {
    label: 'Mental Health Crisis',
    description: 'Content detailing severe psychological distress, panic, or psychotic episodes.'
  }
};

export const CRISIS_RESOURCES = [
  {
    name: 'Suicide & Crisis Lifeline (US/CA)',
    contact: 'Call or Text 988',
    detail: 'Free, confidential support available 24/7'
  },
  {
    name: 'Crisis Text Line',
    contact: 'Text HOME to 741741',
    detail: 'Connect with a crisis counselor 24/7'
  },
  {
    name: 'National Domestic Violence Hotline',
    contact: '1-800-799-SAFE (7233)',
    detail: 'Confidential support, chat, and resources'
  },
  {
    name: 'SAMHSA National Helpline',
    contact: '1-800-662-4357',
    detail: 'Treatment referral and info service for mental health / substance use'
  },
  {
    name: 'International Resources (Befrienders Worldwide)',
    contact: 'www.befrienders.org',
    detail: 'Support hotlines across 32 countries worldwide'
  }
];

export const CRISIS_DISCLAIMER =
  'StoryBabe is a personal storytelling platform and is not a crisis service. If you or someone you know is in distress or immediate danger, please reach out to the crisis resources listed above or local emergency services.';

export type ReportCategory =
  | 'NO_CONSENT'
  | 'HARASSMENT'
  | 'SPAM'
  | 'COPYRIGHT'
  | 'OTHER';

export type ReportPriority = 'HIGH' | 'NORMAL';

export type ReportStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type ModerationActionType = 'WARNING' | 'UNPUBLISH' | 'RESTRICT_USER' | 'DISMISS';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  followersCount: number;
  followingCount: number;
  storiesCount: number;
  lastUsernameChangeAt?: string | null;
  usernameChangesCount: number;
  canChangeUsername: boolean;
  daysUntilNextUsernameChange: number;
  createdAt: string;
}

export interface ActiveAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  latestStoryId: string;
  latestStoryTitle: string;
  latestStoryOneliner?: string | null;
  hasUnread?: boolean;
}

export interface AuthUser extends UserProfile {
  email: string; // only provided to self on authenticated requests
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface Story {
  id: string;
  authorId: string;
  author: UserProfile;
  title: string;
  summary: string;
  oneliner?: string | null;
  posterUrl?: string | null;
  posterStyle?: PosterStyle;
  posterType?: PosterType;
  content?: string; // Present for SINGLE stories
  type: StoryType;
  status: StoryStatus;
  onHoldReason?: string | null;
  isInactive: boolean;
  inactiveTaggedAt?: string | null;
  allowComments: boolean;
  safetyFlags: SafetyFlag[];
  tags: string[];
  viewsCount: number;
  likesCount: number;
  commentsCount?: number;
  episodesCount: number;
  readingTimeMinutes: number;
  isLikedByViewer?: boolean;
  isBookmarkedByViewer?: boolean;
  episodes?: Episode[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface Episode {
  id: string;
  storyId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  content: string;
  status: EpisodeStatus;
  onHoldReason?: string | null;
  viewsCount: number;
  likesCount: number;
  readingTimeMinutes: number;
  isLikedByViewer?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  storyId: string;
  episodeId?: string | null;
  userId: string;
  user: UserProfile;
  content: string;
  parentId?: string | null;
  likesCount: number;
  isLikedByViewer?: boolean;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporter?: UserProfile;
  storyId: string;
  story?: Story;
  episodeId?: string | null;
  category: ReportCategory;
  priority: ReportPriority;
  status: ReportStatus;
  reason: string;
  moderatorNotes?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAction {
  id: string;
  reportId?: string | null;
  moderatorId: string;
  moderator?: UserProfile;
  actionType: ModerationActionType;
  targetType: 'STORY' | 'EPISODE' | 'USER' | 'COMMENT';
  targetId: string;
  notes: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  message?: string;
}

export interface StoryFilterParams {
  type?: StoryType;
  status?: StoryStatus;
  completedOnly?: boolean;
  authorId?: string;
  tag?: string;
  search?: string;
  safetyFlag?: SafetyFlag;
  page?: number;
  limit?: number;
  sortBy?: 'recent' | 'popular' | 'views';
}
