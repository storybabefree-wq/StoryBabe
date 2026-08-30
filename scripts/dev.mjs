import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Automatically load StoryBabe.env if present, otherwise .env
if (fs.existsSync('StoryBabe.env')) {
  dotenv.config({ path: 'StoryBabe.env' });
} else {
  dotenv.config();
}

const services = [
  { name: 'AUTH      ', path: 'services/auth/dist/server.js', port: 4001 },
  { name: 'STORY     ', path: 'services/story/dist/server.js', port: 4002 },
  { name: 'SOCIAL    ', path: 'services/social/dist/server.js', port: 4003 },
  { name: 'MODERATION', path: 'services/moderation/dist/server.js', port: 4004 },
  { name: 'WORKER    ', path: 'services/worker/dist/server.js', port: 4005 },
  { name: 'GATEWAY   ', path: 'apps/gateway/dist/server.js', port: 4000 }
];

console.log('Starting StoryBabe Microservices Network...');

const procs = [];

for (const svc of services) {
  const fullPath = path.resolve(process.cwd(), svc.path);
  const p = spawn('node', [fullPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: svc.port.toString(), GATEWAY_PORT: '4000' }
  });

  p.on('error', (err) => {
    console.error(`[${svc.name}] Failed to start:`, err);
  });

  procs.push(p);
}

// Start Next.js Web App
const nextBin = path.resolve(process.cwd(), 'node_modules/.bun/node_modules/next/dist/bin/next');
console.log('Starting StoryBabe Next.js Web Application...');
const webProc = spawn('node', [nextBin, 'dev', 'apps/web', '-p', '3000'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4000/api/v1' }
});

procs.push(webProc);

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down all services...');
  for (const p of procs) {
    p.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const p of procs) {
    p.kill('SIGTERM');
  }
  process.exit(0);
});
