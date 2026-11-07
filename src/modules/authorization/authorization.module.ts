import { ClinicContextRepository } from "./domain/clinic-context.repository";
import { SqlClinicContextRepository } from "./infrastructure/sql-clinic-context.repository";
import { RolesRepository } from "./domain/roles.repository";
import { SqlRolesRepository } from "./infrastructure/sql-roles.repository";
import { CrudRolesUseCase } from "./application/crudRoles.usecase";
import { CatalogRoleUseCase } from "./application/catalogRole.usecase";
import { RolesController } from "./presentation/roles.controller";
import { PermissionsController } from "./presentation/permissions.controller";
import { Module } from "@nestjs/common";
import { AuthorizationStore } from "./infrastructure/authorization.store";
/** Provides relational role and permission adapters to identity and authentication. */
@Module({
  providers: [
    { provide: ClinicContextRepository, useClass: SqlClinicContextRepository },
    AuthorizationStore,
    CrudRolesUseCase,
    CatalogRoleUseCase,
    { provide: RolesRepository, useClass: SqlRolesRepository }
  ],
  controllers: [RolesController, PermissionsController],
  exports: [AuthorizationStore, RolesRepository, ClinicContextRepository]
})
export class AuthorizationModule {}
