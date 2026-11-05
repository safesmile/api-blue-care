import { RolesRepository } from "./domain/roles.repository";
import { SqlRolesRepository } from "./infrastructure/sql-roles.repository";
import { RolesUseCase } from "./application/roles.usecase";
import { RolesController } from "./presentation/roles.controller";
import { PermissionsController } from "./presentation/permissions.controller";
import { Module } from "@nestjs/common";
import { AuthorizationStore } from "./infrastructure/authorization.store";
/** Provides relational role and permission adapters to identity and authentication. */
@Module({
  providers: [AuthorizationStore, RolesUseCase, { provide: RolesRepository, useClass: SqlRolesRepository }],
  controllers: [RolesController, PermissionsController],
  exports: [AuthorizationStore, RolesRepository]
})
export class AuthorizationModule {}
