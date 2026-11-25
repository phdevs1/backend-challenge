-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('scheduled', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "reminder_status" AS ENUM ('pending', 'sent', 'failed', 'skipped', 'cancelled');

-- CreateEnum
CREATE TYPE "skip_reason" AS ENUM ('too_late', 'no_phone', 'opted_out');

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "skip_reason" "skip_reason",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_clinic_id_idx" ON "appointments"("clinic_id");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "reminders_appointment_id_idx" ON "reminders"("appointment_id");

-- CreateIndex
CREATE INDEX "reminders_status_scheduled_for_idx" ON "reminders"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
