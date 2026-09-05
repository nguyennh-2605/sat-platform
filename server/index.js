const app = require('./src/app');
const prisma = require('./src/config/prisma');

const PORT = process.env.PORT || 5000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

// --- KHỞI ĐỘNG SERVER ---
const server = app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

let isShuttingDown = false;
const shutdown = signal => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ event: 'server.shutdown.started', signal }));

  const forceShutdown = setTimeout(() => {
    console.error(JSON.stringify({ event: 'server.shutdown.forced', timeoutMs: SHUTDOWN_TIMEOUT_MS }));
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceShutdown.unref();

  server.close(async error => {
    clearTimeout(forceShutdown);
    try {
      await prisma.$disconnect();
      console.log(JSON.stringify({ event: 'server.shutdown.completed', signal }));
    } catch (disconnectError) {
      console.error(JSON.stringify({ event: 'server.shutdown.failed', errorName: disconnectError?.name }));
      process.exitCode = 1;
    }
    if (error) {
      console.error(JSON.stringify({ event: 'server.shutdown.failed', errorName: error?.name }));
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
