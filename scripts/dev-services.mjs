import { spawn } from 'child_process';
import path from 'path';

const services = [
  { name: 'AUTH      ', path: 'services/auth/dist/server.js', port: 4001 },
  { name: 'STORY     ', path: 'services/story/dist/server.js', port: 4002 },
  { name: 'SOCIAL    ', path: 'services/social/dist/server.js', port: 4003 },
  { name: 'MODERATION', path: 'services/moderation/dist/server.js', port: 4004 },
  { name: 'WORKER    ', path: 'services/worker/dist/server.js', port: 4005 },
  { name: 'GATEWAY   ', path: 'apps/gateway/dist/server.js', port: 4000 }
];

console.log('🚀 Starting StoryBabe Microservices Network (Backend Services + Gateway)...');

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

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down services...');
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
