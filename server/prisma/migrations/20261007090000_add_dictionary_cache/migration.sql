CREATE TABLE "DictionaryCache" (
    "language" VARCHAR(8) NOT NULL DEFAULT 'en',
    "word" VARCHAR(64) NOT NULL,
    "found" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DictionaryCache_pkey" PRIMARY KEY ("language", "word")
);

CREATE INDEX "DictionaryCache_expiresAt_idx" ON "DictionaryCache"("expiresAt");
