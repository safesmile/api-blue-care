import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditRepository } from "./domain/audit.repository";
import { CrudAuditUseCase } from "./application/crudAudit.usecase";
import { SqlAuditRepository } from "./infrastructure/sql-audit.repository";
import { AuditInterceptor } from "./infrastructure/audit.interceptor";
import { AuditController } from "./presentation/audit.controller";
/** Provides read access and safe request context; resource adapters own transactional event writes. */
@Module({
  providers: [
    CrudAuditUseCase,
    { provide: AuditRepository, useClass: SqlAuditRepository },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }
  ],
  controllers: [AuditController]
})
export class AuditModule {}
