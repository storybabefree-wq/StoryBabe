import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);

// Automatically load StoryBabe.env if present, otherwise .env
if (fs.existsSync('StoryBabe.env')) {
  dotenv.config({ path: 'StoryBabe.env' });
} else {
  dotenv.config();
}

// Check if services are built; if not, build them first
if (!fs.existsSync('services/auth/dist/server.js')) {
  console.log('Building TypeScript services before startup...');
  execSync('npm run build:services', { stdio: 'inherit' });
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
let nextBin = '';
try {
  const nextPkg = require.resolve('next/package.json', { paths: ['apps/web', process.cwd()] });
  nextBin = path.join(path.dirname(nextPkg), 'dist/bin/next');
} catch {
  nextBin = 'next';
}

console.log('Starting StoryBabe Next.js Web Application on http://localhost:3000 ...');
const webProc = spawn(process.platform === 'win32' && !nextBin.endsWith('.js') && !nextBin.includes(path.sep) ? 'npx.cmd' : 'node', 
  nextBin.endsWith('.js') || nextBin.includes(path.sep) ? [nextBin, 'dev', 'apps/web', '-p', '3000'] : ['next', 'dev', 'apps/web', '-p', '3000'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1' }
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
