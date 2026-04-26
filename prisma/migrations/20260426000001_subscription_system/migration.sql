-- Rename BUSINESS → CUSTOM (PostgreSQL supports this in-place — safe, no downtime)
ALTER TYPE "SubscriptionPlan" RENAME VALUE 'BUSINESS' TO 'CUSTOM';

-- Add trackingProvider column to shipments
ALTER TABLE "shipments" ADD COLUMN "trackingProvider" TEXT NOT NULL DEFAULT 'jsoncargo';

-- Add isLiveTracking column to shipments
ALTER TABLE "shipments" ADD COLUMN "isLiveTracking" BOOLEAN NOT NULL DEFAULT false;

-- Update Subscription schema default (existing FREE rows: 0 or 3 → 5)
ALTER TABLE "subscriptions" ALTER COLUMN "maxTrackedShipments" SET DEFAULT 5;
UPDATE "subscriptions" SET "maxTrackedShipments" = 5 WHERE "plan" = 'FREE';

-- Update maxDailyQueries default for new FREE subscriptions
ALTER TABLE "subscriptions" ALTER COLUMN "maxDailyQueries" SET DEFAULT 50;

-- Create ContactRequestStatus enum
CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'CLOSED');

-- Create contact_requests table
CREATE TABLE "contact_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "containersCount" INTEGER NOT NULL,
    "message" TEXT,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_requests_pkey" PRIMARY KEY ("id")
);
