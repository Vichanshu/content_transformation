-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "generationMetadata" JSONB;

-- CreateTable
CREATE TABLE "GenerationDraft" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationDraft_jobId_outputType_idx" ON "GenerationDraft"("jobId", "outputType");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationDraft_jobId_outputType_persona_key" ON "GenerationDraft"("jobId", "outputType", "persona");

-- AddForeignKey
ALTER TABLE "GenerationDraft" ADD CONSTRAINT "GenerationDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
