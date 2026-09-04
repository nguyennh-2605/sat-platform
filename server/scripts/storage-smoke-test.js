/*
  Performs a real write -> metadata -> read -> delete round trip against the
  configured S3-compatible bucket. It never writes to the application database.

  Required opt-in:
    STORAGE_SMOKE_ENABLED=true npm run storage:smoke

  Use a dedicated development/CI bucket when possible. The temporary object is
  deleted in finally, including when an assertion fails after upload.
*/

require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { getObjectStorage } = require('../src/storage/object-storage');

if (process.env.STORAGE_SMOKE_ENABLED !== 'true') {
  console.error(JSON.stringify({
    event: 'storage.smoke.disabled',
    message: 'Set STORAGE_SMOKE_ENABLED=true for this command only.',
  }));
  process.exit(1);
}

const payload = Buffer.from(`sat-platform-storage-smoke:${randomUUID()}`, 'utf8');
const storageKey = `smoke/${Date.now()}-${randomUUID()}.txt`;
const mimeType = 'text/plain';
const startedAt = Date.now();
let uploaded = false;
let step = 'initialize';

const main = async () => {
  const storage = getObjectStorage();
  console.log(JSON.stringify({ event: 'storage.smoke.started', provider: storage.provider }));

  try {
    step = 'presign-upload';
    const uploadUrl = await storage.createUploadUrl({ storageKey, mimeType });
    step = 'upload';
    uploaded = true;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: payload,
    });
    assert.equal(uploadResponse.ok, true, `Upload returned HTTP ${uploadResponse.status}.`);

    step = 'verify-metadata';
    const metadata = await storage.headObject({ storageKey });
    assert.equal(metadata.sizeBytes, payload.length, 'Uploaded object size does not match.');
    assert.equal(metadata.mimeType, mimeType, 'Uploaded object content type does not match.');

    step = 'presign-read';
    const readUrl = await storage.createReadUrl({ storageKey, downloadName: 'storage-smoke.txt' });
    step = 'read';
    const readResponse = await fetch(readUrl);
    assert.equal(readResponse.ok, true, `Read returned HTTP ${readResponse.status}.`);
    assert.deepEqual(Buffer.from(await readResponse.arrayBuffer()), payload, 'Downloaded object content does not match.');

    console.log(JSON.stringify({
      event: 'storage.smoke.verified',
      sizeBytes: payload.length,
      durationMs: Date.now() - startedAt,
    }));
  } finally {
    if (uploaded) {
      try { await storage.deleteObject({ storageKey }); }
      catch (error) {
        error.storageSmokeStep = 'cleanup';
        throw error;
      }
      console.log(JSON.stringify({ event: 'storage.smoke.cleaned' }));
    }
  }
};

main().catch(error => {
  console.error(JSON.stringify({
    event: 'storage.smoke.failed',
    step: error?.storageSmokeStep || step,
    errorName: error?.name,
    errorCode: error?.Code || error?.code,
    durationMs: Date.now() - startedAt,
  }));
  process.exitCode = 1;
});
