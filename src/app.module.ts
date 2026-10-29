import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnvironment } from "./infrastructure/config/environment";
import { IdentityModule } from "./modules/identity/identity.module";
import { AuthModule } from "./modules/auth/auth.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { AppController } from "./app.controller";
/**
 * Wires the providers and controllers for this module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: "postgres",
        host: config.getOrThrow<string>("DB_HOST"),
        port: Number(config.getOrThrow("DB_PORT")),
        database: config.getOrThrow<string>("DB_NAME"),
        username: config.getOrThrow<string>("DB_USER"),
        password: config.getOrThrow<string>("DB_PASSWORD"),
        dialectOptions: config.get("DB_SSL") === "true" ? { ssl: { require: true, rejectUnauthorized: true } } : {},
        autoLoadModels: true,
        synchronize: false,
        logging: false
      })
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    IdentityModule,
    AuthModule,
    StorageModule
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
