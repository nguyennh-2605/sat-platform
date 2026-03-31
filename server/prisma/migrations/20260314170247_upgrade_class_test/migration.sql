-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "classTestId" INTEGER;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_classTestId_fkey" FOREIGN KEY ("classTestId") REFERENCES "ClassTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
