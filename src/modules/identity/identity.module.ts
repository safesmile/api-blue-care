import { UsersRules } from "./application/usersRules.service";
import { AuthorizationModule } from "../authorization/authorization.module";
import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { UserModel } from "./infrastructure/user.model";
import { IdentityRepository } from "./domain/identity.repository";
import { PasswordHasher } from "./domain/password-hasher";
import { SequelizeIdentityRepository } from "./infrastructure/sequelize-identity.repository";
import { BcryptPasswordHasher } from "./infrastructure/bcrypt-password-hasher";
import { CollaboratorsUserUseCase } from "./application/collaboratorsUser.usecase";
import { CollaboratorUserUseCase } from "./application/collaboratorUser.usecase";
import { CrudUsersUseCase } from "./application/crudUsers.usecase";
import { UsersController } from "./presentation/users.controller";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  imports: [AuthorizationModule, SequelizeModule.forFeature([UserModel])],
  providers: [
    UsersRules,
    { provide: IdentityRepository, useClass: SequelizeIdentityRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    CollaboratorsUserUseCase,
    CollaboratorUserUseCase,
    CrudUsersUseCase
  ],
  controllers: [UsersController],
  exports: [IdentityRepository, PasswordHasher]
})
export class IdentityModule {}
