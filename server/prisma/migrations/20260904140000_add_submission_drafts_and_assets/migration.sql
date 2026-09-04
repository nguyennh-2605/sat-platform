CREATE TYPE "SubmissionContentSlot" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "SubmissionItemKind" AS ENUM ('FILE', 'LINK');
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'PENDING_DELETE');

ALTER TABLE "HomeworkSubmission" ALTER COLUMN "submittedAt" DROP NOT NULL;
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "submittedAt" DROP DEFAULT;

CREATE TABLE "HomeworkSubmissionContent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "slot" "SubmissionContentSlot" NOT NULL,
    "textResponse" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomeworkSubmissionContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeworkSubmissionItem" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "kind" "SubmissionItemKind" NOT NULL,
    "fileAssetId" TEXT,
    "externalUrl" TEXT,
    "displayName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomeworkSubmissionItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomeworkSubmissionItem_payload_check" CHECK (
      ("kind" = 'FILE' AND "fileAssetId" IS NOT NULL AND "externalUrl" IS NULL)
      OR
      ("kind" = 'LINK' AND "fileAssetId" IS NULL AND "externalUrl" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "HomeworkSubmissionContent_submissionId_slot_key" ON "HomeworkSubmissionContent"("submissionId", "slot");
CREATE INDEX "HomeworkSubmissionContent_submissionId_updatedAt_idx" ON "HomeworkSubmissionContent"("submissionId", "updatedAt");
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_ownerId_status_createdAt_idx" ON "FileAsset"("ownerId", "status", "createdAt");
CREATE INDEX "FileAsset_status_createdAt_idx" ON "FileAsset"("status", "createdAt");
CREATE INDEX "HomeworkSubmissionItem_contentId_order_idx" ON "HomeworkSubmissionItem"("contentId", "order");
CREATE INDEX "HomeworkSubmissionItem_fileAssetId_idx" ON "HomeworkSubmissionItem"("fileAssetId");

ALTER TABLE "HomeworkSubmissionContent" ADD CONSTRAINT "HomeworkSubmissionContent_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmissionItem" ADD CONSTRAINT "HomeworkSubmissionItem_contentId_fkey"
FOREIGN KEY ("contentId") REFERENCES "HomeworkSubmissionContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmissionItem" ADD CONSTRAINT "HomeworkSubmissionItem_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve every legacy submission as the official snapshot. Legacy fileUrl values
-- represented external links, even when their path happened to resemble a file.
INSERT INTO "HomeworkSubmissionContent" ("id", "submissionId", "slot", "textResponse", "version", "createdAt", "updatedAt")
SELECT 'legacy-content-' || "id", "id", 'SUBMITTED', "textResponse", 1, COALESCE("submittedAt", CURRENT_TIMESTAMP), "updatedAt"
FROM "HomeworkSubmission";

INSERT INTO "HomeworkSubmissionItem" ("id", "contentId", "kind", "externalUrl", "displayName", "order", "createdAt", "updatedAt")
SELECT 'legacy-item-' || "id", 'legacy-content-' || "id", 'LINK', "fileUrl", NULL, 0, COALESCE("submittedAt", CURRENT_TIMESTAMP), "updatedAt"
FROM "HomeworkSubmission"
WHERE "fileUrl" IS NOT NULL AND BTRIM("fileUrl") <> '';
