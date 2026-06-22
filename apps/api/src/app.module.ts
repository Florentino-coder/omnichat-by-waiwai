import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { InboxModule } from "./inbox/inbox.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { LineModule } from "./line/line.module";
import { MailModule } from "./mail/mail.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RedisModule } from "./redis/redis.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { SuperAdminModule } from "./super-admin/super-admin.module";
import { ScheduleModule } from "@nestjs/schedule";
import { StorageModule } from "./storage/storage.module";
import { BackupModule } from "./backup/backup.module";
import { MonitorModule } from "./monitor/monitor.module";
import { CustomersModule } from "./customers/customers.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { ScenarioModule } from "./scenario/scenario.module";
import { AutomationModule } from "./automation/automation.module";
import { LlmModule } from "./common/llm/llm.module";
import { ReportingModule } from "./reporting/reporting.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MailModule,
    HealthModule,
    AuthModule,
    InvitationsModule,
    UsersModule,
    AuditLogsModule,
    InboxModule,
    RealtimeModule,
    TenantsModule,
    WorkspacesModule,
    LineModule,
    SuperAdminModule,
    StorageModule,
    BackupModule,
    MonitorModule,
    CustomersModule,
    KnowledgeModule,
    ScenarioModule,
    AutomationModule,
    LlmModule,
    ReportingModule
  ]
})
export class AppModule {}
