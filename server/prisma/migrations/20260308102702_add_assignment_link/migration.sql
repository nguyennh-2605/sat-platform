/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Assignment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "fileUrl",
ADD COLUMN     "fileUrls" TEXT[],
ADD COLUMN     "links" TEXT[];
