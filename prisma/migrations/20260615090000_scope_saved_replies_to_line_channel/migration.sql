ALTER TABLE "saved_replies" ADD COLUMN "lineChannelId" TEXT;

CREATE INDEX "saved_replies_tenantId_lineChannelId_idx" ON "saved_replies"("tenantId", "lineChannelId");

ALTER TABLE "saved_replies"
  ADD CONSTRAINT "saved_replies_lineChannelId_fkey"
  FOREIGN KEY ("lineChannelId")
  REFERENCES "line_channels"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
