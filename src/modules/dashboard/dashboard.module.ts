import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { DashboardRepository } from "./domain/dashboard.repository";
import { SqlDashboardRepository } from "./infrastructure/sql-dashboard.repository";
import { DashboardUseCase } from "./application/dashboard.usecase";
import { DashboardController } from "./presentation/dashboard.controller";
/**
 * Defines the validated prevention, dashboard or notification contract.
 */
@Module({
  imports: [ClinicsModule],
  providers: [DashboardUseCase, { provide: DashboardRepository, useClass: SqlDashboardRepository }],
  controllers: [DashboardController]
})
export class DashboardModule {}
