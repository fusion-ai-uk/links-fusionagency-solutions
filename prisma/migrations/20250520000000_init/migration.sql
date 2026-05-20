-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "campaign_id" TEXT,
    "recipient_token" TEXT,
    "message_id" TEXT,
    "link_id" TEXT,
    "destination_url" TEXT,
    "ip_hash" TEXT,
    "ip_country" TEXT,
    "ip_region" TEXT,
    "ip_city" TEXT,
    "user_agent" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_events_event_type_idx" ON "email_events"("event_type");

-- CreateIndex
CREATE INDEX "email_events_campaign_id_idx" ON "email_events"("campaign_id");

-- CreateIndex
CREATE INDEX "email_events_recipient_token_idx" ON "email_events"("recipient_token");

-- CreateIndex
CREATE INDEX "email_events_link_id_idx" ON "email_events"("link_id");

-- CreateIndex
CREATE INDEX "email_events_created_at_idx" ON "email_events"("created_at");
