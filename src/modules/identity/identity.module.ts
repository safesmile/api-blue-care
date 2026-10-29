import { AuthorizationModule } from "../authorization/authorization.module";
import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { UserModel } from "./infrastructure/user.model";
import { IdentityRepository } from "./domain/identity.repository";
import { PasswordHasher } from "./domain/password-hasher";
import { SequelizeIdentityRepository } from "./infrastructure/sequelize-identity.repository";
import { BcryptPasswordHasher } from "./infrastructure/bcrypt-password-hasher";
import { UsersUseCase } from "./application/users.usecase";
import { UsersController } from "./presentation/users.controller";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  imports: [AuthorizationModule, SequelizeModule.forFeature([UserModel])],
  providers: [
    { provide: IdentityRepository, useClass: SequelizeIdentityRepository },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    UsersUseCase
  ],
  controllers: [UsersController],
  exports: [IdentityRepository, PasswordHasher]
})
export class IdentityModule {}
