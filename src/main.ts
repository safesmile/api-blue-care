import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { loadSecrets } from "./infrastructure/config/load-secrets";
/**
 * Loads configuration and starts the HTTP application.
 */
async function bootstrap() {
  await loadSecrets();
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: config
      .getOrThrow<string>("CORS_ORIGINS")
      .split(",")
      .map(value => value.trim())
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.enableShutdownHooks();
  await app.listen(Number(config.getOrThrow("PORT")), "0.0.0.0");
}
void bootstrap();
