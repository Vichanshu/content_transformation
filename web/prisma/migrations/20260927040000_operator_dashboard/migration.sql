-- Make inline text a first-class source and expose the formatting checkpoint.
ALTER TYPE "JobStatus" ADD VALUE 'FORMATTING';
ALTER TABLE "Job" ALTER COLUMN "inputUrl" DROP NOT NULL,
ADD COLUMN "inputText" TEXT;
