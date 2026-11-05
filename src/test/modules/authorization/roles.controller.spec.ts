import request from "supertest";
import { RolesController } from "../../../modules/authorization/presentation/roles.controller";
import { RolesUseCase } from "../../../modules/authorization/application/roles.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("RolesController", () => {
  const roles = {
    list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    read: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };
  const actor = userFixture().toView(),
    id = "ba50a6d7-3ec5-4fb0-9145-2febbfaf8de8";
  const input = { name: "reception", description: "Reception", permissions: ["auth:me"] };
  let app;
  beforeAll(async () => {
    app = await controllerApp(RolesController, [{ provide: RolesUseCase, useValue: roles }], actor);
  });
  afterAll(async () => {
    await app.close();
  });
  it("forwards the session actor for every operation", async () => {
    await request(app.getHttpServer()).get("/roles").expect(200);
    await request(app.getHttpServer())
      .get("/roles/" + id)
      .expect(200);
    await request(app.getHttpServer()).post("/roles").send(input).expect(201);
    await request(app.getHttpServer())
      .put("/roles/" + id)
      .send(input)
      .expect(200);
    await request(app.getHttpServer())
      .delete("/roles/" + id)
      .expect(204);
    expect(roles.create).toHaveBeenCalledWith(input, actor);
    expect(roles.read).toHaveBeenCalledWith(id, actor);
    expect(roles.update).toHaveBeenCalledWith(id, input, actor);
    expect(roles.delete).toHaveBeenCalledWith(id, actor);
  });
  it("rejects invalid identifiers, names, duplicate permissions and hidden privilege fields", async () => {
    await request(app.getHttpServer()).get("/roles/invalid").expect(400);
    await request(app.getHttpServer()).get("/roles?limit=101").expect(400);
    await request(app.getHttpServer())
      .post("/roles")
      .send({ ...input, isProtected: true })
      .expect(400);
    await request(app.getHttpServer())
      .post("/roles")
      .send({ ...input, name: "../admin" })
      .expect(400);
    await request(app.getHttpServer())
      .post("/roles")
      .send({ ...input, permissions: ["auth:me", "auth:me"] })
      .expect(400);
  });
});
