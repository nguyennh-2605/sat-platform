CREATE TYPE "FileAssetPurpose" AS ENUM ('GENERAL', 'TEST_IMAGE');

ALTER TABLE "FileAsset" ADD COLUMN "purpose" "FileAssetPurpose" NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "TestImageUsage" (
    "testId" INTEGER NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    CONSTRAINT "TestImageUsage_pkey" PRIMARY KEY ("testId", "fileAssetId")
);

CREATE INDEX "TestImageUsage_fileAssetId_idx" ON "TestImageUsage"("fileAssetId");

ALTER TABLE "TestImageUsage" ADD CONSTRAINT "TestImageUsage_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestImageUsage" ADD CONSTRAINT "TestImageUsage_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
