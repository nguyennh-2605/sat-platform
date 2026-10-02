CREATE TABLE "QuestionBankImageUsage" (
    "questionId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,

    CONSTRAINT "QuestionBankImageUsage_pkey" PRIMARY KEY ("questionId", "fileAssetId")
);

CREATE INDEX "QuestionBankImageUsage_fileAssetId_idx" ON "QuestionBankImageUsage"("fileAssetId");

ALTER TABLE "QuestionBankImageUsage"
ADD CONSTRAINT "QuestionBankImageUsage_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "QuestionBankItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionBankImageUsage"
ADD CONSTRAINT "QuestionBankImageUsage_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
