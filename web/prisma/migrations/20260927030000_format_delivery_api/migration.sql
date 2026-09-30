-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "requestOptions" JSONB,
ADD COLUMN     "requestedTier" "ProcessingTier";
