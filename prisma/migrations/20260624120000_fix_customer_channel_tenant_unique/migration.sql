-- DropIndex
DROP INDEX "customer_channels_channel_type_channel_user_id_key";

-- DropIndex
DROP INDEX "line_channels_tenantId_lineChannelId_key";

-- CreateIndex
CREATE UNIQUE INDEX "customer_channels_tenant_id_channel_type_channel_user_id_key" ON "customer_channels"("tenant_id", "channel_type", "channel_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "line_channels_lineChannelId_key" ON "line_channels"("lineChannelId");
