-- CreateEnum
CREATE TYPE "TestMode" AS ENUM ('PRACTICE', 'EXAM');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "mode" "TestMode" NOT NULL DEFAULT 'PRACTICE';
