import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { prisma } from '@storybabe/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;

app.use(express.json());

// Inactivity Scanner function
// Identifies series with no updates or new episodes in 60+ days
export async function runInactivityScanner(): Promise<{
  scannedCount: number;
  newlyTaggedCount: number;
  taggedStoryIds: string[];
}> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  // Find candidate series:
  // 1. type = 'SERIES'
  // 2. status = 'ONGOING'
  // 3. isInactive = false
  // 4. updatedAt < 60 days ago
  const candidates = await prisma.story.findMany({
    where: {
      type: 'SERIES',
      status: 'ONGOING',
      isInactive: false,
      updatedAt: { lt: sixtyDaysAgo }
    },
    include: {
      episodes: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  const taggedStoryIds: string[] = [];

  for (const story of candidates) {
    const latestEpisode = story.episodes[0];
    const latestActivity = latestEpisode
      ? new Date(Math.max(new Date(story.updatedAt).getTime(), new Date(latestEpisode.createdAt).getTime()))
      : new Date(story.updatedAt);

    if (latestActivity < sixtyDaysAgo) {
      await prisma.story.update({
        where: { id: story.id },
        data: {
          isInactive: true,
          inactiveTaggedAt: new Date()
        }
      });
      taggedStoryIds.push(story.id);
    }
  }

  console.log(`[Worker] Inactivity scan complete: ${taggedStoryIds.length} series marked Inactive (informational).`);
  return {
    scannedCount: candidates.length,
    newlyTaggedCount: taggedStoryIds.length,
    taggedStoryIds
  };
}

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'worker-service', timestamp: new Date().toISOString() });
});

// Trigger Inactivity Scan on Demand
app.post('/jobs/inactivity-scan', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await runInactivityScanner();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Worker] Scan error:', error);
    res.status(500).json({ success: false, error: { code: 'SCAN_FAILED', message: error.message } });
  }
});

// Scheduled Interval (every 1 hour in background)
const SCAN_INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  runInactivityScanner().catch((err) => console.error('[Worker] Periodic scan failed:', err));
}, SCAN_INTERVAL_MS);

// Run initial scan on startup
setTimeout(() => {
  runInactivityScanner().catch((err) => console.error('[Worker] Initial scan failed:', err));
}, 5000);

app.listen(PORT, () => {
  console.log(`StoryBabe Worker Service running on port ${PORT}`);
});
