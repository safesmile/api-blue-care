import { Module } from "@nestjs/common";
import { AuthorizationStore } from "./infrastructure/authorization.store";
/** Provides relational role and permission adapters to identity and authentication. */
@Module({ providers: [AuthorizationStore], exports: [AuthorizationStore] })
export class AuthorizationModule {}
