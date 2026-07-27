-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('CARDIO', 'STRENGTH', 'FLEXIBILITY', 'OTHER');

-- CreateTable
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kg" DECIMAL(5,1) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sleep_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(3,1) NOT NULL,
    "quality" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sleep_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "glasses" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "workoutType" "WorkoutType" NOT NULL DEFAULT 'OTHER',
    "durationMinutes" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weight_logs_userId_date_idx" ON "weight_logs"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "weight_logs_userId_date_key" ON "weight_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "sleep_logs_userId_date_idx" ON "sleep_logs"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sleep_logs_userId_date_key" ON "sleep_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "water_logs_userId_date_idx" ON "water_logs"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "water_logs_userId_date_key" ON "water_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "workout_logs_userId_date_idx" ON "workout_logs"("userId", "date");

-- AddForeignKey
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
