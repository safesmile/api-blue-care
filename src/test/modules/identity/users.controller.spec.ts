import { NotFoundException, type INestApplication } from "@nestjs/common";
import request from "supertest";
import { UsersController } from "../../../modules/identity/presentation/users.controller";
import { UsersUseCase } from "../../../modules/identity/application/users.usecase";
import { controllerApp } from "../../helpers/controller-app";
import { userFixture } from "../../helpers/identity.fixture";
describe("UsersController", () => {
  let app: INestApplication;
  const users = { create: jest.fn(), read: jest.fn(), list: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const user = userFixture().toView();
  beforeAll(async () => {
    app = await controllerApp(UsersController, [{ provide: UsersUseCase, useValue: users }]);
  });
  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => {
    await app.close();
  });
  it("normalizes and forwards valid creation data", async () => {
    users.create.mockResolvedValue(user);
    await request(app.getHttpServer())
      .post("/users")
      .send({ email: "ADMIN@BLUE.TEST", name: "Admin", password: "SecurePassword1!", roles: [] })
      .expect(201, user);
    expect(users.create).toHaveBeenCalledWith({
      email: "admin@blue.test",
      name: "Admin",
      password: "SecurePassword1!",
      roles: []
    });
  });
  it("rejects privilege fields outside the DTO", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .send({ email: "admin@blue.test", name: "Admin", password: "SecurePassword1!", roles: [], enabled: true })
      .expect(400);
    expect(users.create).not.toHaveBeenCalled();
  });
  it("reads by UUID", async () => {
    users.read.mockResolvedValue(user);
    await request(app.getHttpServer())
      .get("/users/" + user.id)
      .expect(200, user);
    expect(users.read).toHaveBeenCalledWith(user.id);
  });
  it("rejects invalid UUIDs", async () => {
    await request(app.getHttpServer()).get("/users/invalid").expect(400);
    expect(users.read).not.toHaveBeenCalled();
  });
  it("preserves not-found errors", async () => {
    users.read.mockRejectedValue(new NotFoundException());
    await request(app.getHttpServer())
      .get("/users/" + user.id)
      .expect(404);
  });
  it("uses default pagination", async () => {
    users.list.mockResolvedValue({ items: [user], total: 1 });
    await request(app.getHttpServer())
      .get("/users")
      .expect(200, { items: [user], total: 1 });
    expect(users.list).toHaveBeenCalledWith({ limit: 25, offset: 0 });
  });
  it("converts explicit pagination to numbers", async () => {
    users.list.mockResolvedValue({ items: [], total: 0 });
    await request(app.getHttpServer()).get("/users?limit=5&offset=10").expect(200);
    expect(users.list).toHaveBeenCalledWith({ limit: 5, offset: 10 });
  });
  it.each(["limit=0", "limit=101", "offset=-1", "limit=oops"])("rejects invalid pagination %s", async query => {
    await request(app.getHttpServer())
      .get("/users?" + query)
      .expect(400);
    expect(users.list).not.toHaveBeenCalled();
  });
  it("updates permitted fields", async () => {
    users.update.mockResolvedValue({ ...user, name: "Dentist" });
    await request(app.getHttpServer())
      .patch("/users/" + user.id)
      .send({ name: "Dentist" })
      .expect(200);
    expect(users.update).toHaveBeenCalledWith(user.id, { name: "Dentist" });
  });
  it("rejects password updates through the user CRUD", async () => {
    await request(app.getHttpServer())
      .patch("/users/" + user.id)
      .send({ password: "SecretPassword1!" })
      .expect(400);
    expect(users.update).not.toHaveBeenCalled();
  });
  it("deletes by UUID", async () => {
    await request(app.getHttpServer())
      .delete("/users/" + user.id)
      .expect(200);
    expect(users.delete).toHaveBeenCalledWith(user.id);
  });
  it("enforces the eight-character minimum when creating users", async () => {
    const input = { email: "admin@blue.test", name: "Admin", roles: [] };
    await request(app.getHttpServer())
      .post("/users")
      .send({ ...input, password: "Abc123!" })
      .expect(400);
    expect(users.create).not.toHaveBeenCalled();
    users.create.mockResolvedValue(user);
    await request(app.getHttpServer())
      .post("/users")
      .send({ ...input, password: "Abcd123!" })
      .expect(201);
    expect(users.create).toHaveBeenCalledWith({ ...input, password: "Abcd123!" });
  });
});
