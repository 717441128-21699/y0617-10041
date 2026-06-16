import 'dotenv/config';
import app from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { CronScheduler } from './cron';

async function main() {
  try {
    await prisma.$connect();
    console.log('[Database] Connected successfully');

    await redis.ping();
    console.log('[Redis] Connected successfully');

    CronScheduler.start();

    const server = app.listen(config.port, () => {
      console.log(`[Server] Running on http://${config.baseDomain}:${config.port}`);
      console.log(`[Server] API docs available at http://${config.baseDomain}:${config.port}/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        console.log('[Server] HTTP server closed');
      });

      CronScheduler.stop();

      await prisma.$disconnect();
      console.log('[Database] Disconnected');

      redis.disconnect();
      console.log('[Redis] Disconnected');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
}

main();
