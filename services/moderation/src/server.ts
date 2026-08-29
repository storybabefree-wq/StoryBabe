import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  prisma,
  formatStory,
  formatUserProfile
} from '@storybabe/database';
import {
  getUserContext,
  requireAuth,
  requireRole,
  createReportSchema,
  moderationActionSchema
} from '@storybabe/security';
import type { ReportPriority, ReportStatus } from '@storybabe/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4004;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: any, res: any) => {
  res.json({ status: 'ok', service: 'moderation-service', timestamp: new Date().toISOString() });
});

// File a Report (Any logged-in reader can report)
app.post('/reports', requireAuth, async (req: any, res: any): Promise<void> => {
  try {
    const { userId } = getUserContext(req);
    const parseResult = createReportSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { storyId, episodeId, category, reason } = parseResult.data;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Story not found' } });
      return;
    }

    const priority: ReportPriority = category === 'NO_CONSENT' ? 'HIGH' : 'NORMAL';

    const report = await prisma.report.create({
      data: {
        reporterId: userId!,
        storyId,
        episodeId: episodeId || null,
        category,
        priority,
        status: 'PENDING',
        reason
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: report?.id,
        category: report?.category,
        priority: report?.priority,
        status: report?.status,
        createdAt: report?.createdAt
      },
      message:
        category === 'NO_CONSENT'
          ? 'Your report has been routed to our Priority Review Queue for immediate evaluation.'
          : 'Thank you. Your report has been submitted to our moderation desk.'
    });
  } catch (error: any) {
    console.error('File report error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to file report' } });
  }
});

// List Moderation Queue (Requires MODERATOR or ADMIN role)
app.get('/reports', requireAuth, requireRole('MODERATOR', 'ADMIN'), async (req: any, res: any): Promise<void> => {
  try {
    const { queue, status = 'PENDING', page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (queue === 'priority') {
      where.priority = 'HIGH';
    } else if (queue === 'standard') {
      where.priority = 'NORMAL';
    }

    if (status !== 'ALL') {
      where.status = status as ReportStatus;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: limitNum
      }),
      prisma.report.count({ where })
    ]);

    const formattedReports = reports.map((r: any) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporter: r.reporter ? formatUserProfile(r.reporter) : null,
      storyId: r.storyId,
      story: r.story ? formatStory(r.story) : null,
      episodeId: r.episodeId,
      episode: r.episode ? { id: r.episode.id, title: r.episode.title, episodeNumber: r.episode.episodeNumber } : null,
      category: r.category,
      priority: r.priority,
      status: r.status,
      reason: r.reason,
      moderatorNotes: r.moderatorNotes,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      actionsCount: r.actions?.length || 0
    }));

    res.json({
      success: true,
      data: formattedReports,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('List reports error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list reports' } });
  }
});

// Get Moderation Stats (Queue counts)
app.get('/reports/stats', requireAuth, requireRole('MODERATOR', 'ADMIN'), async (req: any, res: any): Promise<void> => {
  try {
    const [priorityPending, standardPending, resolvedTotal] = await Promise.all([
      prisma.report.count({ where: { priority: 'HIGH', status: 'PENDING' } }),
      prisma.report.count({ where: { priority: 'NORMAL', status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } })
    ]);

    res.json({
      success: true,
      data: {
        priorityPending,
        standardPending,
        resolvedTotal,
        totalPending: priorityPending + standardPending
      }
    });
  } catch (error: any) {
    console.error('Report stats error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to retrieve stats' } });
  }
});

// Take Moderation Action (WARNING, UNPUBLISH, RESTRICT_USER, DISMISS)
app.post('/reports/:id/action', requireAuth, requireRole('MODERATOR', 'ADMIN'), async (req: any, res: any): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = getUserContext(req);

    const report = await prisma.report.findUnique({
      where: { id }
    });

    if (!report) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } });
      return;
    }

    const parseResult = moderationActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message }
      });
      return;
    }

    const { actionType, targetType, targetId, notes } = parseResult.data;

    await prisma.$transaction(async (tx) => {
      await tx.moderationAction.create({
        data: {
          reportId: id,
          moderatorId: userId!,
          actionType,
          targetType,
          targetId,
          notes
        }
      });

      if (actionType === 'UNPUBLISH') {
        if (targetType === 'STORY') {
          await tx.story.update({
            where: { id: targetId },
            data: { isUnpublished: true }
          });
        }
      }

      const newStatus = actionType === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
      await tx.report.update({
        where: { id },
        data: {
          status: newStatus,
          moderatorNotes: notes,
          resolvedById: userId!,
          resolvedAt: new Date().toISOString()
        }
      });
    });

    res.json({
      success: true,
      message: `Moderation action (${actionType}) recorded and report updated.`
    });
  } catch (error: any) {
    console.error('Moderation action error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to record action' } });
  }
});

app.listen(PORT, () => {
  console.log(`StoryBabe Moderation Service running on port ${PORT}`);
});
