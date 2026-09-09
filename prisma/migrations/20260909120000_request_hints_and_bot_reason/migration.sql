-- Request hints, used to tell browser navigations from programmatic fetches
-- (link-protection scanners, link previewers). All nullable: rows recorded
-- before this migration simply have no hints.
ALTER TABLE "email_events"
    ADD COLUMN "bot_reason" TEXT,
    ADD COLUMN "accept_language" TEXT,
    ADD COLUMN "accept_header" TEXT,
    ADD COLUMN "sec_fetch_mode" TEXT,
    ADD COLUMN "sec_fetch_dest" TEXT,
    ADD COLUMN "sec_fetch_user" TEXT,
    ADD COLUMN "sec_fetch_site" TEXT,
    ADD COLUMN "client_kind" TEXT;

-- Supports clustering near-simultaneous clicks on the same link.
CREATE INDEX "email_events_campaign_id_link_id_created_at_idx"
    ON "email_events"("campaign_id", "link_id", "created_at");
