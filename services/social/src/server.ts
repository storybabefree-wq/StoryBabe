import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  prisma,
  formatComment,
  formatStory,
  formatUserProfile
} from '@storybabe/database';
import {
  getUserContext,
  requireAuth,
  createCommentSchema
} from '@storybabe/security';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok', service: 'social-service', timestamp: new Date().toISOString() });
});

// Follow / Unfollow Toggle (One-directional, no approval needed)
app.post('/follows/:authorId', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const authorId = req.params.authorId as string;
    const { userId } = getUserContext(req);

    if (userId === authorId) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_FOLLOW_SELF', message: 'You cannot follow yourself' }
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id: authorId } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Target author not found' } });
      return;
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId!,
          followingId: authorId
        }
      }
    });

    let isFollowing = false;
    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      isFollowing = false;
    } else {
      await prisma.follow.create({
        data: {
          followerId: userId!,
          followingId: authorId
        }
      });
      isFollowing = true;
    }

    const followersCount = await prisma.follow.count({ where: { followingId: authorId } });

    res.json({
      success: true,
      data: {
        isFollowing,
        followersCount
      }
    });
  } catch (error: any) {
    console.error('Follow error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update follow status' } });
  }
});

// Check Follow Status
app.get('/follows/status/:authorId', async (req: any, res: any): Promise<void> => {
  try {
    const authorId = req.params.authorId as string;
    const { userId } = getUserContext(req);

    if (!userId) {
      res.json({ success: true, data: { isFollowing: false } });
      return;
    }

    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: authorId
        }
      }
    });

    res.json({ success: true, data: { isFollowing: !!follow } });
  } catch (error: any) {
    console.error('Get follow status error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to check follow status' } });
  }
});

// Following Feed (Stories from followed authors)
app.get('/feed/following', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const { page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const follows = await prisma.follow.findMany({
      where: { followerId: userId! }
    });

    const followingIds = follows.map((f: any) => f.followingId);

    if (followingIds.length === 0) {
      res.json({
        success: true,
        data: [],
        meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 }
      });
      return;
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where: { authorId: { in: followingIds } },
        skip,
        take: limitNum
      }),
      prisma.story.count({ where: { authorId: { in: followingIds } } })
    ]);

    res.json({
      success: true,
      data: stories.map((s: any) => formatStory(s, userId)),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Following feed error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch following feed' } });
  }
});

// List Story Comments (Threaded)
app.get('/stories/:storyId/comments', async (req: any, res: any): Promise<void> => {
  try {
    const storyId = req.params.storyId as string;
    const { episodeId } = req.query;
    const { userId } = getUserContext(req);

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    const where: any = {
      storyId,
      parentId: null
    };

    if (episodeId) {
      where.episodeId = episodeId as string;
    }

    const comments = await prisma.comment.findMany({
      where
    });

    res.json({
      success: true,
      data: comments.map((c: any) => formatComment(c, userId)),
      allowComments: story.allowComments
    });
  } catch (error: any) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch comments' } });
  }
});

// Post Comment (Rule: Comments on by default, author can disable per individual story)
app.post('/stories/:storyId/comments', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const storyId = req.params.storyId as string;
    const { userId } = getUserContext(req);

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    if (!story.allowComments) {
      res.status(403).json({
        success: false,
        error: { code: 'COMMENTS_DISABLED', message: 'The author has disabled comments for this story.' }
      });
      return;
    }

    const parseResult = createCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { content, episodeId, parentId } = parseResult.data;

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
      if (!parentComment || parentComment.storyId !== storyId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PARENT_COMMENT', message: 'Parent comment does not exist for this story' }
        });
        return;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        storyId,
        episodeId: episodeId || null,
        userId: userId!,
        parentId: parentId || null,
        content
      }
    });

    res.status(201).json({
      success: true,
      data: formatComment(comment, userId)
    });
  } catch (error: any) {
    console.error('Post comment error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to post comment' } });
  }
});

// Toggle Comment Like
app.post('/comments/:commentId/like', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const commentId = req.params.commentId as string;
    const { userId } = getUserContext(req);

    const existing = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: {
          userId: userId!,
          commentId
        }
      }
    });

    let isLiked = false;
    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      isLiked = false;
    } else {
      await prisma.commentLike.create({
        data: {
          userId: userId!,
          commentId
        }
      });
      isLiked = true;
    }

    const likesCount = await prisma.commentLike.count({ where: { commentId } });

    res.json({
      success: true,
      data: {
        isLiked,
        likesCount
      }
    });
  } catch (error: any) {
    console.error('Comment like error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to toggle comment like' } });
  }
});

// Toggle Bookmark
app.post('/bookmarks/:storyId', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const storyId = req.params.storyId as string;
    const { userId } = getUserContext(req);

    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_storyId: {
          userId: userId!,
          storyId
        }
      }
    });

    let isBookmarked = false;
    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      isBookmarked = false;
    } else {
      await prisma.bookmark.create({
        data: {
          userId: userId!,
          storyId
        }
      });
      isBookmarked = true;
    }

    res.json({
      success: true,
      data: { isBookmarked }
    });
  } catch (error: any) {
    console.error('Bookmark error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update bookmark' } });
  }
});

// Get User Bookmarks
app.get('/bookmarks', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: userId! }
    });

    res.json({
      success: true,
      data: bookmarks.map((b: any) => formatStory(b.story, userId))
    });
  } catch (error: any) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch bookmarks' } });
  }
});

app.listen(PORT, () => {
  console.log(`StoryBabe Social Service running on port ${PORT}`);
});
