import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CONNECT_TRANSPORT, ConnectClient } from "./connect.client";
import { httpsConnectTransport } from "./connect-transport";
import { ConnectionsController } from "./connections.controller";
import { ConnectionsService } from "./connections.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ConnectionsController],
  providers: [
    { provide: CONNECT_TRANSPORT, useValue: httpsConnectTransport },
    ConnectClient,
    ConnectionsService
  ]
})
export class IntegrationsModule {}
