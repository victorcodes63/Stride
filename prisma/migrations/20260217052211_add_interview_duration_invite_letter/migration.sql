-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "inviteSentAt" TIMESTAMP(3),
ADD COLUMN     "officialLetterPath" TEXT;
