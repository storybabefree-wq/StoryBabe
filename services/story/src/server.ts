import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  prisma,
  formatStory,
  formatEpisode
} from '@storybabe/database';
import {
  getUserContext,
  requireAuth,
  createStorySchema,
  updateStorySchema,
  createEpisodeSchema
} from '@storybabe/security';
import {
  CRISIS_RESOURCES,
  CRISIS_DISCLAIMER,
  SAFETY_FLAG_INFO,
  AESTHETIC_PRESETS
} from '@storybabe/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok', service: 'story-service', timestamp: new Date().toISOString() });
});

// Get Crisis Resources & Safety Info
app.get('/safety-resources', (req: any, res: any) => {
  res.json({
    success: true,
    data: {
      flags: SAFETY_FLAG_INFO,
      resources: CRISIS_RESOURCES,
      disclaimer: CRISIS_DISCLAIMER
    }
  });
});

// Get Active Authors for Top Story Tray
app.get('/stories/active-authors', async (req: any, res: any): Promise<void> => {
  try {
    const stories = await prisma.story.findMany({ take: 24 });
    const authorsMap = new Map<string, any>();

    for (const s of stories) {
      if (s.author && !authorsMap.has(s.authorId)) {
        authorsMap.set(s.authorId, {
          id: s.author.id,
          username: s.author.username,
          displayName: s.author.displayName,
          avatarUrl: s.author.avatarUrl || null,
          latestStoryId: s.id,
          latestStoryTitle: s.title,
          latestStoryOneliner: s.oneliner || s.title,
          hasUnread: true
        });
      }
    }

    res.json({
      success: true,
      data: Array.from(authorsMap.values())
    });
  } catch (error: any) {
    console.error('Get active authors error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch active authors' } });
  }
});

// AI Scene Prompt Suggestion Helper
function extractScenePrompt(title: string = '', summary: string = '', tags: string[] = []): {
  suggestedPrompt: string;
  detectedMood: string;
  suggestedHook: string;
  styleModifiers: string[];
} {
  const combined = `${title} ${summary} ${tags.join(' ')}`.toLowerCase();

  let mood = 'reflective';
  let visualSubject = 'a quiet window overlooking a misty morning landscape, soft ambient glow';

  if (combined.includes('rehab') || combined.includes('substance') || combined.includes('addict') || combined.includes('night') || combined.includes('midnight') || combined.includes('neon')) {
    mood = 'nocturnal';
    visualSubject = 'a lone figure walking down a wet city avenue illuminated by faint neon and amber streetlights at night, moody atmospheric reflections';
  } else if (combined.includes('coast') || combined.includes('sea') || combined.includes('ocean') || combined.includes('alone') || combined.includes('solitude')) {
    mood = 'solitary';
    visualSubject = 'a rocky coastal shoreline shrouded in dense ocean fog, pale blue waters meeting grey sand, melancholic stillness';
  } else if (combined.includes('grief') || combined.includes('loss') || combined.includes('mother') || combined.includes('father') || combined.includes('coat') || combined.includes('rain')) {
    mood = 'poignant';
    visualSubject = 'a vintage wooden chair next to a rain-streaked window pane with warm golden afternoon light piercing through storm clouds';
  } else if (combined.includes('hope') || combined.includes('dawn') || combined.includes('recover') || combined.includes('heal') || combined.includes('growth')) {
    mood = 'uplifting';
    visualSubject = 'a sunrise breaking over rolling countryside hills, golden hour haze, dewdrops on wild grass, tranquil warmth';
  } else if (combined.includes('career') || combined.includes('work') || combined.includes('office') || combined.includes('city')) {
    mood = 'introspective';
    visualSubject = 'an empty subway platform at late dusk, dramatic architectural shadows, cinematic depth of field, warm tungsten lighting';
  }

  const suggestedPrompt = `Cinematic 35mm film photograph of ${visualSubject}. Natural lighting, subtle Kodak Portra film grain, muted emotional color palette, fine art editorial composition, no text, no lettering, no watermarks, 4:5 vertical portrait framing.`;

  let suggestedHook = '';
  if (summary) {
    const sentences = summary.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length > 0) {
      suggestedHook = sentences[0].trim();
    } else {
      suggestedHook = summary.length > 110 ? summary.substring(0, 107) + '...' : summary;
    }
  } else {
    suggestedHook = title;
  }

  return {
    suggestedPrompt,
    detectedMood: mood,
    suggestedHook,
    styleModifiers: [
      '35mm Film Grain',
      'Golden Hour Warmth',
      'Rainy Dusk Noir',
      'Minimalist Fog',
      'Vintage Polaroid',
      'Cinematic Desaturated'
    ]
  };
}

// 1. Suggest Visual Scene Prompt from Story
app.post('/stories/suggest-prompt', async (req: any, res: any): Promise<void> => {
  try {
    const { title = '', content = '', summary = '', tags = [] } = req.body;
    const result = extractScenePrompt(title, summary || content, tags);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Suggest prompt error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to suggest visual prompt' } });
  }
});

// 2. OpenRouter AI Poster Generator with Base64 output & curated fallback
app.post('/stories/generate-poster', async (req: any, res: any): Promise<void> => {
  try {
    const {
      title = '',
      summary = '',
      content = '',
      tags = [],
      prompt: customPrompt,
      modifiers = [],
      oneliner: customOneliner,
      style = 'bottom-gradient'
    } = req.body;

    const analysis = extractScenePrompt(title, summary || content, tags);
    const finalPrompt = customPrompt ? `${customPrompt} ${modifiers.join(', ')}` : analysis.suggestedPrompt;
    const finalOneliner = customOneliner || analysis.suggestedHook;

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_IMAGE_MODEL || 'black-forest-labs/flux-1-schnell';

    let generatedPosterUrl: string | null = null;
    let generatorSource = 'CURATED_PRESET';

    // Call OpenRouter if API key is provided
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'StoryBabe'
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: finalPrompt
              }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (response.ok) {
          const json: any = await response.json();
          const imageUrl = json.choices?.[0]?.message?.content || json.choices?.[0]?.message?.image_url;
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            // Fetch image and convert to durable Base64 data URI
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const base64Str = Buffer.from(arrayBuf).toString('base64');
              const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
              generatedPosterUrl = `data:${contentType};base64,${base64Str}`;
              generatorSource = 'OPENROUTER_AI';
            }
          }
        }
      } catch (openRouterErr) {
        console.error('OpenRouter generation error, using fallback:', openRouterErr);
      }
    }

    // Fallback to high quality atmospheric visual preset if OpenRouter did not return image
    if (!generatedPosterUrl) {
      const matched = AESTHETIC_PRESETS.find((p) => p.name.toLowerCase().includes(analysis.detectedMood)) || AESTHETIC_PRESETS[0];
      generatedPosterUrl = matched.imageUrl;
      generatorSource = 'CURATED_PRESET';
    }

    res.json({
      success: true,
      data: {
        posterUrl: generatedPosterUrl,
        oneliner: finalOneliner,
        posterStyle: style,
        posterType: 'AI',
        source: generatorSource,
        prompt: finalPrompt,
        detectedMood: analysis.detectedMood,
        allPresets: AESTHETIC_PRESETS
      }
    });
  } catch (error: any) {
    console.error('Generate poster error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to generate poster' } });
  }
});

// Popular Tags list
app.get('/tags/popular', async (req: any, res: any): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({ take: 20 });
    res.json({
      success: true,
      data: tags.map((t: any) => ({
        id: t.id,
        name: t.name,
        count: t._count?.stories || 0
      }))
    });
  } catch (error: any) {
    console.error('Get tags error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch tags' } });
  }
});

// List Stories (Feed / Discovery)
app.get('/stories', async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const {
      type,
      status,
      completedOnly,
      authorId,
      tag,
      search,
      safetyFlag,
      page = '1',
      limit = '12',
      sortBy = 'recent'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (type) where.type = type as string;
    if (completedOnly === 'true' || completedOnly === '1') {
      where.status = 'COMPLETED';
    } else if (status) {
      where.status = status as string;
    }

    if (authorId) where.authorId = authorId as string;
    if (tag) where.tag = (tag as string).toLowerCase();
    if (safetyFlag) where.safetyFlag = safetyFlag as string;

    if (search) {
      const query = (search as string).trim();
      where.OR = [
        { title: { contains: query } },
        { summary: { contains: query } },
        { content: { contains: query } }
      ];
    }

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        where,
        skip,
        take: limitNum
      }),
      prisma.story.count({ where })
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
    console.error('List stories error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch stories' } });
  }
});

// Get Single Story by ID
app.get('/stories/:id', async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const story = await prisma.story.findUnique({
      where: { id }
    });

    if (!story || story.isUnpublished) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Story not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: formatStory(story, userId)
    });
  } catch (error: any) {
    console.error('Get story error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve story' } });
  }
});

// Create Story
app.post('/stories', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const parseResult = createStorySchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten()
        }
      });
      return;
    }

    const {
      title,
      summary,
      oneliner,
      posterUrl,
      posterStyle,
      posterType,
      content,
      type,
      status,
      onHoldReason,
      allowComments,
      safetyFlags,
      tags
    } = parseResult.data;

    if (type === 'SINGLE' && (!content || content.trim().length < 20)) {
      res.status(400).json({
        success: false,
        error: { code: 'CONTENT_REQUIRED', message: 'Single stories must include text content of at least 20 characters.' }
      });
      return;
    }

    const createdStory = await prisma.$transaction(async (tx) => {
      const story = await tx.story.create({
        data: {
          authorId: userId!,
          title,
          summary,
          oneliner: oneliner || null,
          posterUrl: posterUrl || null,
          posterStyle: posterStyle || 'bottom-gradient',
          posterType: posterType || 'PRESET',
          content: type === 'SINGLE' ? content : null,
          type,
          status,
          onHoldReason: status === 'ON_HOLD' ? onHoldReason : null,
          allowComments,
          isInactive: false
        }
      });

      if (safetyFlags && safetyFlags.length > 0) {
        for (const flag of safetyFlags) {
          await tx.storySafetyFlag.create({
            data: { storyId: story.id, flag }
          });
        }
      }

      if (tags && tags.length > 0) {
        for (const rawTag of tags) {
          const cleanTag = rawTag.trim().toLowerCase();
          if (cleanTag) {
            let tagRecord = await tx.tag.findUnique({ where: { name: cleanTag } });
            if (!tagRecord) {
              tagRecord = await tx.tag.create({ data: { name: cleanTag } });
            }
            await tx.storyTag.create({
              data: { storyId: story.id, tagId: tagRecord.id }
            });
          }
        }
      }

      return tx.story.findUnique({ where: { id: story.id } });
    });

    res.status(201).json({
      success: true,
      data: formatStory(createdStory, userId)
    });
  } catch (error: any) {
    console.error('Create story error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create story' } });
  }
});

// Update Story Metadata & Status
app.put('/stories/:id', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId, role } = getUserContext(req);

    const existingStory = await prisma.story.findUnique({ where: { id } });
    if (!existingStory) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    if (existingStory.authorId !== userId && role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only author can edit this story' } });
      return;
    }

    const parseResult = updateStorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const {
      title,
      summary,
      oneliner,
      posterUrl,
      posterStyle,
      posterType,
      content,
      status,
      onHoldReason,
      allowComments,
      safetyFlags,
      tags
    } = parseResult.data;

    const shouldDismissInactive = existingStory.isInactive;

    const updatedStory = await prisma.$transaction(async (tx) => {
      const story = await tx.story.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(summary !== undefined ? { summary } : {}),
          ...(oneliner !== undefined ? { oneliner } : {}),
          ...(posterUrl !== undefined ? { posterUrl } : {}),
          ...(posterStyle !== undefined ? { posterStyle } : {}),
          ...(posterType !== undefined ? { posterType } : {}),
          ...(content !== undefined && existingStory.type === 'SINGLE' ? { content } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(status === 'ON_HOLD' ? { onHoldReason } : status ? { onHoldReason: null } : {}),
          ...(allowComments !== undefined ? { allowComments } : {}),
          ...(shouldDismissInactive ? { isInactive: false, inactiveTaggedAt: null } : {})
        }
      });

      if (safetyFlags !== undefined) {
        await tx.storySafetyFlag.deleteMany({ where: { storyId: id } });
        for (const flag of safetyFlags) {
          await tx.storySafetyFlag.create({ data: { storyId: id, flag } });
        }
      }

      if (tags !== undefined) {
        await tx.storyTag.deleteMany({ where: { storyId: id } });
        for (const rawTag of tags) {
          const cleanTag = rawTag.trim().toLowerCase();
          if (cleanTag) {
            let tagRecord = await tx.tag.findUnique({ where: { name: cleanTag } });
            if (!tagRecord) {
              tagRecord = await tx.tag.create({ data: { name: cleanTag } });
            }
            await tx.storyTag.create({ data: { storyId: id, tagId: tagRecord.id } });
          }
        }
      }

      return tx.story.findUnique({ where: { id } });
    });

    res.json({
      success: true,
      data: formatStory(updatedStory, userId)
    });
  } catch (error: any) {
    console.error('Update story error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update story' } });
  }
});

// Dismiss Inactive Tag explicitly by Author
app.post('/stories/:id/dismiss-inactive', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    if (story.authorId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only author can dismiss inactive status' } });
      return;
    }

    const updated = await prisma.story.update({
      where: { id },
      data: {
        isInactive: false,
        inactiveTaggedAt: null
      }
    });

    res.json({
      success: true,
      data: formatStory(updated, userId),
      message: 'Inactive tag dismissed'
    });
  } catch (error: any) {
    console.error('Dismiss inactive error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to dismiss inactive tag' } });
  }
});

// Track Story View
app.post('/stories/:id/view', async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    await prisma.$transaction(async (tx) => {
      await tx.storyView.create({
        data: {
          storyId: id,
          userId: userId || null,
          ipAddress: ip
        }
      });
      await tx.story.update({
        where: { id },
        data: { viewsCount: { increment: 1 } }
      });
    });

    res.json({ success: true, message: 'View recorded' });
  } catch (error: any) {
    console.error('Track story view error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record view' } });
  }
});

// Toggle Story Like (Resonance)
app.post('/stories/:id/like', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const existingLike = await prisma.storyLike.findUnique({
      where: {
        userId_storyId: {
          userId: userId!,
          storyId: id
        }
      }
    });

    let liked = false;

    if (existingLike) {
      await prisma.$transaction(async (tx) => {
        await tx.storyLike.delete({ where: { id: existingLike.id } });
        await tx.story.update({
          where: { id },
          data: { likesCount: { decrement: 1 } }
        });
      });
      liked = false;
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.storyLike.create({
          data: {
            userId: userId!,
            storyId: id
          }
        });
        await tx.story.update({
          where: { id },
          data: { likesCount: { increment: 1 } }
        });
      });
      liked = true;
    }

    const story = await prisma.story.findUnique({ where: { id } });

    res.json({
      success: true,
      data: {
        isLiked: liked,
        likesCount: story?.likesCount || 0
      }
    });
  } catch (error: any) {
    console.error('Toggle story like error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to toggle like' } });
  }
});

// Add Episode to Series
app.post('/stories/:id/episodes', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const story = await prisma.story.findUnique({ where: { id } });
    if (!story) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    if (story.type !== 'SERIES') {
      res.status(400).json({ success: false, error: { code: 'NOT_A_SERIES', message: 'Cannot add episodes to a Single story' } });
      return;
    }

    if (story.authorId !== userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the story author can publish episodes' } });
      return;
    }

    const parseResult = createEpisodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { seasonNumber, episodeNumber, title, content, status, onHoldReason } = parseResult.data;

    const existing = await prisma.episode.findUnique({
      where: {
        storyId_seasonNumber_episodeNumber: {
          storyId: id,
          seasonNumber,
          episodeNumber
        }
      }
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: 'EPISODE_EXISTS', message: `Season ${seasonNumber}, Episode ${episodeNumber} already exists` }
      });
      return;
    }

    const episode = await prisma.$transaction(async (tx) => {
      await tx.story.update({
        where: { id },
        data: {
          isInactive: false,
          inactiveTaggedAt: null,
          updatedAt: new Date().toISOString()
        }
      });

      return tx.episode.create({
        data: {
          storyId: id,
          seasonNumber,
          episodeNumber,
          title,
          content,
          status,
          onHoldReason: status === 'ON_HOLD' ? onHoldReason : null
        }
      });
    });

    res.status(201).json({
      success: true,
      data: formatEpisode(episode, userId)
    });
  } catch (error: any) {
    console.error('Create episode error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create episode' } });
  }
});

// Get Single Episode
app.get('/episodes/:id', async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const episode = await prisma.episode.findUnique({
      where: { id }
    });

    if (!episode) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Episode not found' } });
      return;
    }

    res.json({
      success: true,
      data: formatEpisode(episode, userId),
      story: formatStory(episode.story, userId)
    });
  } catch (error: any) {
    console.error('Get episode error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch episode' } });
  }
});

// Track Episode View
app.post('/episodes/:id/view', async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    const episode = await prisma.episode.findUnique({ where: { id } });
    if (!episode) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Episode not found' } });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.episodeView.create({
        data: {
          episodeId: id,
          userId: userId || null,
          ipAddress: ip
        }
      });
      await tx.episode.update({
        where: { id },
        data: { viewsCount: { increment: 1 } }
      });
      await tx.story.update({
        where: { id: episode.storyId },
        data: { viewsCount: { increment: 1 } }
      });
    });

    res.json({ success: true, message: 'Episode view recorded' });
  } catch (error: any) {
    console.error('Track episode view error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record episode view' } });
  }
});

// Toggle Episode Like
app.post('/episodes/:id/like', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const existing = await prisma.episodeLike.findUnique({
      where: {
        userId_episodeId: {
          userId: userId!,
          episodeId: id
        }
      }
    });

    let liked = false;
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.episodeLike.delete({ where: { id: existing.id } });
        await tx.episode.update({
          where: { id },
          data: { likesCount: { decrement: 1 } }
        });
      });
      liked = false;
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.episodeLike.create({
          data: {
            userId: userId!,
            episodeId: id
          }
        });
        await tx.episode.update({
          where: { id },
          data: { likesCount: { increment: 1 } }
        });
      });
      liked = true;
    }

    const ep = await prisma.episode.findUnique({ where: { id } });

    res.json({
      success: true,
      data: {
        isLiked: liked,
        likesCount: ep?.likesCount || 0
      }
    });
  } catch (error: any) {
    console.error('Toggle episode like error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to toggle episode like' } });
  }
});

app.listen(PORT, () => {
  console.log(`StoryBabe Story Service running on port ${PORT}`);
});
