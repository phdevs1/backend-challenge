-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "locked_until" TIMESTAMPTZ(3),
ADD COLUMN     "next_attempt_at" TIMESTAMPTZ(3);
