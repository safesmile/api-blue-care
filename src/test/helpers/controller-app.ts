import type { UserView } from "../../modules/identity/domain/user";
import type { Request, Response, NextFunction } from "express";
import { ValidationPipe, type Provider, type Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
/**
 * Starts an isolated controller with validated HTTP inputs.
 * @param controller Controller class under test.
 * @param providers Mocked application dependencies.
 * @param user Domain user to persist.
 * @returns Result of the completed operation.
 */
export async function controllerApp(controller: Type<unknown>, providers: Provider[], user?: UserView) {
  const module = await Test.createTestingModule({ controllers: [controller], providers }).compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (user)
    app.use((request: Request & { user?: UserView }, _response: Response, next: NextFunction) => {
      request.user = user;
      next();
    });
  await app.init();
  return app;
}
