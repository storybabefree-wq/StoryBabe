import { spawn } from 'child_process';
import path from 'path';

// On hosting platforms like Render, process.env.PORT is the public port assigned to the web service.
const publicGatewayPort = process.env.PORT || '4000';

const services = [
  { name: 'AUTH      ', path: 'services/auth/dist/server.js', port: '4001' },
  { name: 'STORY     ', path: 'services/story/dist/server.js', port: '4002' },
  { name: 'SOCIAL    ', path: 'services/social/dist/server.js', port: '4003' },
  { name: 'MODERATION', path: 'services/moderation/dist/server.js', port: '4004' },
  { name: 'WORKER    ', path: 'services/worker/dist/server.js', port: '4005' },
  { name: 'GATEWAY   ', path: 'apps/gateway/dist/server.js', port: publicGatewayPort }
];

console.log(`Starting StoryBabe Microservices Network (Public Gateway on port ${publicGatewayPort})...`);

const procs = [];

async function startAll() {
  for (const svc of services) {
    const fullPath = path.resolve(process.cwd(), svc.path);
    const p = spawn('node', [fullPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: svc.port,
        GATEWAY_PORT: publicGatewayPort,
        AUTH_SERVICE_URL: 'http://127.0.0.1:4001',
        STORY_SERVICE_URL: 'http://127.0.0.1:4002',
        SOCIAL_SERVICE_URL: 'http://127.0.0.1:4003',
        MODERATION_SERVICE_URL: 'http://127.0.0.1:4004',
        WORKER_SERVICE_URL: 'http://127.0.0.1:4005'
      }
    });

    p.on('error', (err) => {
      console.error(`[${svc.name}] Failed to start:`, err);
    });

    procs.push(p);
    // Stagger startup slightly so SQLite WAL and tables initialize smoothly
    await new Promise((res) => setTimeout(res, 200));
  }
}

startAll();

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
