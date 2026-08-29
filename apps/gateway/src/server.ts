import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import {
  verifyAccessToken,
  INTERNAL_SERVICE_SECRET
} from '@storybabe/security';

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
  })
);

app.use(morgan('short'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  }
});
app.use(limiter);

function authenticateGateway(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.headers['x-user-id'] = payload.userId;
      req.headers['x-user-username'] = payload.username;
      req.headers['x-user-role'] = payload.role;
    }
  }
  req.headers['x-internal-secret'] = INTERNAL_SERVICE_SECRET;
  next();
}

app.use(authenticateGateway);

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:4001';
const STORY_SERVICE_URL = process.env.STORY_SERVICE_URL || 'http://127.0.0.1:4002';
const SOCIAL_SERVICE_URL = process.env.SOCIAL_SERVICE_URL || 'http://127.0.0.1:4003';
const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://127.0.0.1:4004';
const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://127.0.0.1:4005';

// Root health checks for cloud deployment platforms (Render, Railway)
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'storybabe-gateway', timestamp: new Date().toISOString() });
});

app.head('/', (req: Request, res: Response) => {
  res.status(200).end();
});

app.get('/health', async (req: Request, res: Response) => {
  const services = [
    { name: 'auth-service', url: `${AUTH_SERVICE_URL}/health` },
    { name: 'story-service', url: `${STORY_SERVICE_URL}/health` },
    { name: 'social-service', url: `${SOCIAL_SERVICE_URL}/health` },
    { name: 'moderation-service', url: `${MODERATION_SERVICE_URL}/health` },
    { name: 'worker-service', url: `${WORKER_SERVICE_URL}/health` }
  ];

  const results: Record<string, string> = {};
  for (const s of services) {
    try {
      const response = await fetch(s.url);
      results[s.name] = response.ok ? 'ONLINE' : 'DEGRADED';
    } catch {
      results[s.name] = 'OFFLINE';
    }
  }

  res.json({
    status: 'ok',
    gateway: 'ONLINE',
    timestamp: new Date().toISOString(),
    services: results
  });
});

const makeProxy = (target: string, prefixToAdd: string = '') =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path: string) => {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      if (prefixToAdd && cleanPath === '/') {
        return prefixToAdd;
      }
      return `${prefixToAdd}${cleanPath}`;
    },
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        if (req.headers['x-user-id']) {
          proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
        if (req.headers['x-user-username']) {
          proxyReq.setHeader('x-user-username', req.headers['x-user-username']);
        }
        if (req.headers['x-user-role']) {
          proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        }
        proxyReq.setHeader('x-internal-secret', INTERNAL_SERVICE_SECRET);
        fixRequestBody(proxyReq, req);
      },
      error: (err: any, req: any, res: any) => {
        console.error('[Gateway Proxy Error]', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: { code: 'BAD_GATEWAY', message: 'Downstream microservice is unavailable' }
          });
        }
      }
    }
  });

// 1. Auth Service Routes
app.use('/api/v1/auth', makeProxy(AUTH_SERVICE_URL, ''));

// 2. Story Service Routes
app.use('/api/v1/stories', makeProxy(STORY_SERVICE_URL, '/stories'));
app.use('/api/v1/episodes', makeProxy(STORY_SERVICE_URL, '/episodes'));
app.use('/api/v1/tags', makeProxy(STORY_SERVICE_URL, '/tags'));
app.use('/api/v1/safety-resources', makeProxy(STORY_SERVICE_URL, '/safety-resources'));

// 3. Social Service Routes
app.use('/api/v1/follows', makeProxy(SOCIAL_SERVICE_URL, '/follows'));
app.use('/api/v1/feed', makeProxy(SOCIAL_SERVICE_URL, '/feed'));
app.use('/api/v1/comments', makeProxy(SOCIAL_SERVICE_URL, ''));
app.use('/api/v1/bookmarks', makeProxy(SOCIAL_SERVICE_URL, '/bookmarks'));

// 4. Moderation Service Routes
app.use('/api/v1/reports', makeProxy(MODERATION_SERVICE_URL, '/reports'));

// 5. Worker Service Routes
app.use('/api/v1/jobs', makeProxy(WORKER_SERVICE_URL, '/jobs'));

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'ENDPOINT_NOT_FOUND', message: `Route ${req.method} ${req.originalUrl} not found on StoryBabe Gateway` }
  });
});

app.listen(PORT, () => {
  console.log(`StoryBabe API Gateway running on http://127.0.0.1:${PORT}`);
});
