import type {
  ApiResponse,
  AuthResponse,
  AuthUser,
  Story,
  Episode,
  Comment,
  UserProfile,
  Report,
  StoryFilterParams
} from '@storybabe/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('storybabe_token');
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('storybabe_token', token);
  } else {
    localStorage.removeItem('storybabe_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const errorMsg = data.error?.message || 'An unexpected error occurred';
    const error = new Error(errorMsg) as any;
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    register: (body: any) => request<ApiResponse<AuthResponse>>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: any) => request<ApiResponse<AuthResponse>>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    getMe: () => request<ApiResponse<AuthUser>>('/auth/me'),
    updateUsername: (username: string) => request<ApiResponse<AuthUser>>('/auth/username', { method: 'PUT', body: JSON.stringify({ username }) }),
    updateProfile: (body: any) => request<ApiResponse<AuthUser>>('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
    getAuthorProfile: (username: string) => request<ApiResponse<UserProfile>>(`/auth/users/${username}`)
  },

  // Stories
  stories: {
    list: (params: StoryFilterParams = {}) => {
      const query = new URLSearchParams();
      if (params.type) query.set('type', params.type);
      if (params.status) query.set('status', params.status);
      if (params.completedOnly) query.set('completedOnly', 'true');
      if (params.authorId) query.set('authorId', params.authorId);
      if (params.tag) query.set('tag', params.tag);
      if (params.search) query.set('search', params.search);
      if (params.safetyFlag) query.set('safetyFlag', params.safetyFlag);
      if (params.page) query.set('page', params.page.toString());
      if (params.limit) query.set('limit', params.limit.toString());
      if (params.sortBy) query.set('sortBy', params.sortBy);

      const qs = query.toString();
      return request<ApiResponse<Story[]>>(`/stories${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => request<ApiResponse<Story>>(`/stories/${id}`),
    create: (body: any) => request<ApiResponse<Story>>('/stories', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<ApiResponse<Story>>(`/stories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    dismissInactive: (id: string) => request<ApiResponse<Story>>(`/stories/${id}/dismiss-inactive`, { method: 'POST' }),
    trackView: (id: string) => request<ApiResponse<any>>(`/stories/${id}/view`, { method: 'POST' }),
    toggleLike: (id: string) => request<ApiResponse<{ isLiked: boolean; likesCount: number }>>(`/stories/${id}/like`, { method: 'POST' }),
    addEpisode: (storyId: string, body: any) => request<ApiResponse<Episode>>(`/stories/${storyId}/episodes`, { method: 'POST', body: JSON.stringify(body) }),
    getPopularTags: () => request<ApiResponse<Array<{ id: string; name: string; count: number }>>>('/tags/popular'),
    getSafetyResources: () => request<ApiResponse<any>>('/safety-resources'),
    getActiveAuthors: () => request<ApiResponse<Array<any>>>('/stories/active-authors'),
    suggestPrompt: (body: { title: string; summary?: string; content?: string; tags?: string[] }) =>
      request<ApiResponse<{ suggestedPrompt: string; detectedMood: string; suggestedHook: string; styleModifiers: string[] }>>('/stories/suggest-prompt', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    generatePoster: (body: {
      title?: string;
      summary?: string;
      content?: string;
      tags?: string[];
      prompt?: string;
      modifiers?: string[];
      oneliner?: string;
      style?: string;
    }) => request<ApiResponse<any>>('/stories/generate-poster', { method: 'POST', body: JSON.stringify(body) })
  },

  // Episodes
  episodes: {
    getById: (id: string) => request<ApiResponse<Episode & { story: Story }>>(`/episodes/${id}`),
    trackView: (id: string) => request<ApiResponse<any>>(`/episodes/${id}/view`, { method: 'POST' }),
    toggleLike: (id: string) => request<ApiResponse<{ isLiked: boolean; likesCount: number }>>(`/episodes/${id}/like`, { method: 'POST' })
  },

  // Social
  social: {
    toggleFollow: (authorId: string) => request<ApiResponse<{ isFollowing: boolean; followersCount: number }>>(`/follows/${authorId}`, { method: 'POST' }),
    getFollowStatus: (authorId: string) => request<ApiResponse<{ isFollowing: boolean }>>(`/follows/status/${authorId}`),
    getFollowingFeed: (page: number = 1) => request<ApiResponse<Story[]>>(`/feed/following?page=${page}`),
    getComments: (storyId: string, episodeId?: string) => {
      const url = episodeId ? `/comments/stories/${storyId}/comments?episodeId=${episodeId}` : `/comments/stories/${storyId}/comments`;
      return request<ApiResponse<Comment[]> & { allowComments: boolean }>(url);
    },
    postComment: (storyId: string, body: { content: string; episodeId?: string | null; parentId?: string | null }) =>
      request<ApiResponse<Comment>>(`/comments/stories/${storyId}/comments`, { method: 'POST', body: JSON.stringify(body) }),
    toggleCommentLike: (commentId: string) => request<ApiResponse<{ isLiked: boolean; likesCount: number }>>(`/comments/comments/${commentId}/like`, { method: 'POST' }),
    toggleBookmark: (storyId: string) => request<ApiResponse<{ isBookmarked: boolean }>>(`/bookmarks/${storyId}`, { method: 'POST' }),
    getBookmarks: () => request<ApiResponse<Story[]>>('/bookmarks')
  },

  // Moderation
  moderation: {
    fileReport: (body: { storyId: string; episodeId?: string | null; category: string; reason: string }) =>
      request<ApiResponse<any>>('/reports', { method: 'POST', body: JSON.stringify(body) }),
    listReports: (queue?: 'priority' | 'standard', status?: string) => {
      const q = new URLSearchParams();
      if (queue) q.set('queue', queue);
      if (status) q.set('status', status);
      const qs = q.toString();
      return request<ApiResponse<Report[]>>(`/reports${qs ? `?${qs}` : ''}`);
    },
    getStats: () => request<ApiResponse<{ priorityPending: number; standardPending: number; resolvedTotal: number; totalPending: number }>>('/reports/stats'),
    takeAction: (reportId: string, body: any) => request<ApiResponse<any>>(`/reports/${reportId}/action`, { method: 'POST', body: JSON.stringify(body) })
  }
};
