require('./instrument');
const app = require('./src/app');
const prisma = require('./src/config/prisma');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

// --- KHỞI ĐỘNG SERVER ---
const server = app.listen(PORT, () => {
  logger.info({ event: 'server.started', port: Number(PORT) }, 'Server started');
});

let isShuttingDown = false;
const shutdown = signal => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ event: 'server.shutdown.started', signal }, 'Server shutdown started');

  const forceShutdown = setTimeout(() => {
    logger.fatal({ event: 'server.shutdown.forced', timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Server shutdown forced');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceShutdown.unref();

  server.close(async error => {
    clearTimeout(forceShutdown);
    try {
      await prisma.$disconnect();
      logger.info({ event: 'server.shutdown.completed', signal }, 'Server shutdown completed');
    } catch (disconnectError) {
      logger.error({ event: 'server.shutdown.failed', err: disconnectError }, 'Prisma disconnect failed');
      process.exitCode = 1;
    }
    if (error) {
      logger.error({ event: 'server.shutdown.failed', err: error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
